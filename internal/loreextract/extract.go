package loreextract

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strconv"
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/jsonrepair"
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
	Style    ContentStyle
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
	Category string `json:"category"`
	Comment  string `json:"comment"`
	// Local models drift on the title field's name despite the prompt asking
	// for "comment"; the common aliases are accepted so entries never arrive
	// untitled. Comment wins when more than one is present.
	Title        string   `json:"title"`
	Name         string   `json:"name"`
	Key          []string `json:"key"`
	KeySecondary []string `json:"keysecondary"`
	Content      string   `json:"content"`
	Order        flexInt  `json:"order"`
	Constant     bool     `json:"constant"`
	Selective    bool     `json:"selective"`
	Characters   []string `json:"characters"`
}

// flexInt tolerates a number arriving as a JSON string ("order": "300"),
// which small models emit; a type mismatch there must not kill the batch. A
// value that is not numeric at all decodes to zero and is left for the
// normaliser to default.
type flexInt int

func (f *flexInt) UnmarshalJSON(b []byte) error {
	s := strings.TrimSpace(strings.Trim(string(b), `"`))
	if v, err := strconv.ParseFloat(s, 64); err == nil {
		*f = flexInt(v)
	}
	return nil
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

	vars := map[string]string{
		"crawl.title":      req.Crawl.Title,
		"crawl.url":        req.Crawl.URL,
		"crawl_context":    compose.CrawlContext(req.Crawl),
		"character_roster": buildCharacterRoster(req.Characters),
		"entry_index":      buildEntryIndex(req.Existing),
	}
	maps.Copy(vars, req.Style.PromptVars())
	userPrompt := prompts.Substitute(template, vars)

	payloads, notes, err := llm.CompleteJSON(ctx, e.completerOrDefault(), req.Endpoint,
		tpl.LorePrompts[prompts.LoreSystem], userPrompt, parseExtraction)
	if err != nil {
		return nil, err
	}
	if req.Mode.OrDefault() == ModeSummary && len(payloads) > 1 {
		payloads = payloads[:1]
	}

	return buildCandidates(payloads, req, notes), nil
}

// parseExtraction decodes an extraction response, tolerating the markdown
// fences models wrap JSON in despite being told not to.
func parseExtraction(content string) ([]entryPayload, error) {
	cleaned := jsonrepair.Clean(content)

	var resp extractionResponse
	err := json.Unmarshal([]byte(cleaned), &resp)
	if err != nil || len(resp.Entries) == 0 {
		// Local models drift between {"entries":[...]} and a bare top-level
		// array of the same objects; accept both shapes.
		var arr []entryPayload
		if json.Unmarshal([]byte(cleaned), &arr) == nil {
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
// and normalises the batch. notes are batch-level recovery notes from the
// completion; they are surfaced on every candidate so the review UI shows
// that the model's output needed mending.
func buildCandidates(payloads []entryPayload, req ExtractRequest, notes []string) []Candidate {
	entries := make([]lorebook.Entry, 0, len(payloads))
	unresolvedPerEntry := make([][]string, 0, len(payloads))

	for _, p := range payloads {
		ids, unresolved := resolveCharacterRefs(p.Characters, req.Characters)
		entries = append(entries, lorebook.Entry{
			Category:     p.Category,
			Comment:      firstNonEmpty(p.Comment, p.Title, p.Name),
			Key:          p.Key,
			KeySecondary: p.KeySecondary,
			Content:      p.Content,
			Order:        int(p.Order),
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
		adjustments := append([]string(nil), r.Adjustments...)
		adjustments = append(adjustments, notes...)
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

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
