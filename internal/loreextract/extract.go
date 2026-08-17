package loreextract

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/prompts"
)

// Extractor turns a crawled page into candidate lorebook entries.
//
// The completer is the injectable seam over the network call, matching
// CharacterGenerator: with a fake completer the whole extraction path —
// prompt building, parsing, character resolution, normalisation — is testable
// without an endpoint.
type Extractor struct {
	completer llm.Completer
}

// NewExtractor returns an Extractor using the given completer, or the
// production HTTP-backed one when it is nil.
func NewExtractor(completer llm.Completer) *Extractor {
	return &Extractor{completer: completer}
}

func (e *Extractor) completerOrDefault() llm.Completer {
	if e.completer != nil {
		return e.completer
	}
	return llm.DefaultCompleter
}

// ExtractRequest is the input to a single extraction.
type ExtractRequest struct {
	Crawl    crawler.CrawlResult
	Mode     ExtractionMode
	Endpoint llm.LLMEndpoint
	// Characters and Existing are the project context. They are what makes
	// extraction-time connections possible: the prompt carries the roster and
	// an index of current entries, so proposed scoping and keys point at things
	// that actually exist.
	Characters []compose.Character
	Existing   []lorebook.Entry
	Templates  prompts.TemplateSet
}

// extractionResponse is the JSON shape the extraction prompts ask for.
type extractionResponse struct {
	Entries []entryPayload `json:"entries"`
}

// entryPayload is the subset of an entry a model is asked to produce. Fields
// the model has no business choosing — uid, position, recursion flags — are set
// by us, so accepting them here would only invite the model to fight the
// normaliser.
type entryPayload struct {
	Category     string   `json:"category"`
	Comment      string   `json:"comment"`
	Key          []string `json:"key"`
	KeySecondary []string `json:"keysecondary"`
	Content      string   `json:"content"`
	Order        int      `json:"order"`
	Constant     bool     `json:"constant"`
	Selective    bool     `json:"selective"`
	Characters   []string `json:"characters"`
}

// Extract runs one extraction and returns reviewable candidates.
//
// The returned candidates are always normalised: a model's raw output is not
// trusted, and Normalize both corrects it and records what it corrected.
func (e *Extractor) Extract(ctx context.Context, req ExtractRequest) ([]Candidate, error) {
	tpl := req.Templates.WithDefaults()

	promptID := prompts.LoreExtractSplit
	if req.Mode.OrDefault() == ModeSummary {
		promptID = prompts.LoreExtractSummary
	}
	template := tpl.LorePrompts[promptID]
	if strings.TrimSpace(template) == "" {
		return nil, fmt.Errorf("no template for lore prompt %s", promptID)
	}

	userPrompt := prompts.Substitute(template, map[string]string{
		"crawl.title":      req.Crawl.Title,
		"crawl.url":        req.Crawl.URL,
		"crawl_context":    compose.CrawlContext(req.Crawl),
		"character_roster": buildCharacterRoster(req.Characters),
		"entry_index":      buildEntryIndex(req.Existing),
	})

	content, err := e.completerOrDefault().Complete(ctx, req.Endpoint, tpl.LorePrompts[prompts.LoreSystem], userPrompt)
	if err != nil {
		return nil, fmt.Errorf("llm complete: %w", err)
	}

	payloads, err := parseExtraction(content)
	if err != nil {
		return nil, err
	}
	if req.Mode.OrDefault() == ModeSummary && len(payloads) > 1 {
		payloads = payloads[:1]
	}

	return buildCandidates(payloads, req), nil
}

// parseExtraction decodes an extraction response, tolerating the markdown
// fences models wrap JSON in despite being told not to.
func parseExtraction(content string) ([]entryPayload, error) {
	cleaned := cleanJSON(content)

	var resp extractionResponse
	err := json.Unmarshal([]byte(cleaned), &resp)
	if err != nil || len(resp.Entries) == 0 {
		// Local models drift between {"entries":[...]} and a bare top-level
		// array of the same objects; accept both shapes.
		var arr []entryPayload
		if arrErr := json.Unmarshal([]byte(cleaned), &arr); arrErr == nil {
			resp.Entries, err = arr, nil
		}
	}
	if err != nil {
		return nil, fmt.Errorf("parse extraction response: %w (got: %s)", err, truncate(cleaned, 200))
	}
	if len(resp.Entries) == 0 {
		return nil, fmt.Errorf("extraction returned no entries")
	}
	return resp.Entries, nil
}

// buildCandidates converts payloads to entries, resolves character references
// and normalises the batch.
func buildCandidates(payloads []entryPayload, req ExtractRequest) []Candidate {
	entries := make([]lorebook.Entry, 0, len(payloads))
	unresolvedPerEntry := make([][]string, 0, len(payloads))

	for _, p := range payloads {
		ids, unresolved := resolveCharacterRefs(p.Characters, req.Characters)
		entries = append(entries, lorebook.Entry{
			Category:     p.Category,
			Comment:      p.Comment,
			Key:          p.Key,
			KeySecondary: p.KeySecondary,
			Content:      p.Content,
			Order:        p.Order,
			Constant:     p.Constant,
			Selective:    p.Selective,
			Characters:   ids,
			SourceURL:    req.Crawl.URL,
		})
		unresolvedPerEntry = append(unresolvedPerEntry, unresolved)
	}

	results := lorebook.NormalizeWith(entries, lorebook.CountConstants(req.Existing), compose.CountTokens)

	candidates := make([]Candidate, len(results))
	for i, r := range results {
		adjustments := r.Adjustments
		if names := unresolvedPerEntry[i]; len(names) > 0 {
			adjustments = append(adjustments, fmt.Sprintf(
				"Could not match to a character in this project, so left unscoped: %s.",
				strings.Join(names, ", ")))
		}
		candidates[i] = Candidate{
			Entry:       r.Entry,
			SourceURL:   req.Crawl.URL,
			Adjustments: adjustments,
			Selected:    true,
		}
	}
	return candidates
}

// cleanJSON strips the markdown fences models add around JSON, and any prose
// before or after the object.
func cleanJSON(content string) string {
	s := strings.TrimSpace(content)

	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimPrefix(s, "json")
		if idx := strings.LastIndex(s, "```"); idx >= 0 {
			s = s[:idx]
		}
		s = strings.TrimSpace(s)
	}

	// Models often add a sentence either side of the payload; keep the
	// outermost object or array — whichever opens first, so an array of
	// objects is not cut down to its first element's braces.
	start := strings.IndexAny(s, "{[")
	if start < 0 {
		return s
	}
	closer := "}"
	if s[start] == '[' {
		closer = "]"
	}
	if end := strings.LastIndex(s, closer); end > start {
		s = s[start : end+1]
	}

	return strings.TrimSpace(s)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
