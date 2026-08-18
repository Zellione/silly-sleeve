package app

import (
	"fmt"
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/loreextract"
)

// Endpoint slots for the lorebook LLM calls. They go through endpointForSlot
// like the character-field slots, so a project can point extraction at a
// different model from the rest of the app without any extra plumbing.
const (
	slotLoreExtract = "loreExtract"
	slotLoreConnect = "loreConnect"
)

// GetStagedSources returns the crawled pages queued for lorebook extraction.
func (a *App) GetStagedSources() []loreextract.StagedSource {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]loreextract.StagedSource{}, a.stagedSources...)
}

// SetStagedSourceMode chooses how a staged page will be broken up: "split"
// into atomic facts, or a single "summary" entry.
func (a *App) SetStagedSourceMode(pageURL string, mode loreextract.ExtractionMode) []loreextract.StagedSource {
	a.mu.Lock()
	defer a.mu.Unlock()
	if i, ok := a.stagedSourceIndexLocked(pageURL); ok {
		a.stagedSources[i].Mode = mode.OrDefault()
	}
	return append([]loreextract.StagedSource{}, a.stagedSources...)
}

// SetStagedSourceStyle chooses how the entries extracted from a staged page
// are written: evocative "prose", or dense "factual" statements.
func (a *App) SetStagedSourceStyle(pageURL string, style loreextract.ContentStyle) []loreextract.StagedSource {
	a.mu.Lock()
	defer a.mu.Unlock()
	if i, ok := a.stagedSourceIndexLocked(pageURL); ok {
		a.stagedSources[i].Style = style.OrDefault()
	}
	return append([]loreextract.StagedSource{}, a.stagedSources...)
}

// RemoveStagedSource drops a staged page and any candidates extracted from it.
// Entries already approved into the lorebook are untouched.
func (a *App) RemoveStagedSource(pageURL string) []loreextract.StagedSource {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.dropStagedSourceLocked(pageURL)
	return append([]loreextract.StagedSource{}, a.stagedSources...)
}

// GetLorebookCandidates returns the extracted entries awaiting review.
func (a *App) GetLorebookCandidates() []loreextract.Candidate {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]loreextract.Candidate{}, a.loreCandidates...)
}

// DiscardLorebookCandidates drops the pending candidates from one page,
// leaving it staged so it can be extracted again.
func (a *App) DiscardLorebookCandidates(pageURL string) []loreextract.Candidate {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.dropCandidatesLocked(pageURL)
	if i, ok := a.stagedSourceIndexLocked(pageURL); ok {
		a.stagedSources[i].Extracted = false
	}
	return append([]loreextract.Candidate{}, a.loreCandidates...)
}

// ExtractLorebookCandidates runs LLM extraction on a staged page and returns
// the candidates for review. Nothing is added to the lorebook here.
//
// The lock is released around the LLM call, following GenerateCharacterBulk:
// extraction takes seconds, and holding the mutex would freeze every other
// binding. The page URL identifies the target across the gap, so a source
// removed mid-flight cannot have its results applied to something else.
func (a *App) ExtractLorebookCandidates(pageURL string) ([]loreextract.Candidate, error) {
	a.mu.Lock()
	staged, ok := a.stagedSourceLocked(pageURL)
	if !ok {
		a.mu.Unlock()
		return nil, fmt.Errorf("that page is not staged for extraction")
	}
	crawl, ok := a.crawlResultByURLLocked(pageURL)
	if !ok {
		a.mu.Unlock()
		return nil, fmt.Errorf("that page is no longer in the crawl")
	}
	req := loreextract.ExtractRequest{
		Crawl:      crawl,
		Mode:       staged.Mode,
		Style:      staged.Style,
		Characters: append([]compose.Character{}, a.characters...),
		Existing:   append([]lorebook.Entry{}, a.lorebookEntries...),
		Templates:  a.settings.PromptTemplates,
	}
	def := a.endpointForSlot(slotLoreExtract)
	a.mu.Unlock()

	if def.URL == "" {
		return nil, fmt.Errorf("no LLM endpoint configured")
	}
	req.Endpoint = toLLMEndpoint(def)

	debugf("lore extract: %s (mode %s, style %s, endpoint %s)", pageURL, staged.Mode.OrDefault(), staged.Style.OrDefault(), def.URL)
	candidates, err := a.loreGen.Extract(a.ctx, req)
	if err != nil {
		logf("lore extract failed: %s: %v", pageURL, err)
		return nil, err
	}
	debugf("lore extract: %s produced %d candidates", pageURL, len(candidates))

	a.mu.Lock()
	defer a.mu.Unlock()
	// The source may have been removed while the request was in flight. Its
	// candidates would be unreachable in the UI, so drop them.
	i, ok := a.stagedSourceIndexLocked(pageURL)
	if !ok {
		return nil, fmt.Errorf("that page was removed while it was being extracted")
	}
	a.stagedSources[i].Extracted = true
	a.dropCandidatesLocked(pageURL)
	a.loreCandidates = append(a.loreCandidates, candidates...)
	return candidates, nil
}

// ApproveLorebookCandidates adds the selected candidates to the lorebook and
// returns the updated entries.
//
// The candidates come back from the frontend rather than being read from
// App state, because the user edits them in the review UI — keys, content,
// category, scoping — and those edits only exist there.
func (a *App) ApproveLorebookCandidates(candidates []loreextract.Candidate) []lorebook.Entry {
	a.mu.Lock()
	defer a.mu.Unlock()

	approved := make(map[string]bool)
	for _, c := range candidates {
		if !c.Selected {
			continue
		}
		entry := c.Entry
		entry.UID = lorebook.NextUID(a.lorebookEntries)
		if entry.SourceURL == "" {
			entry.SourceURL = c.SourceURL
		}
		a.lorebookEntries = append(a.lorebookEntries, entry)
		approved[c.SourceURL] = true
	}

	// Approving consumes the whole review for the pages involved: unticked
	// candidates were rejected, not deferred, and the page itself leaves the
	// staging queue — its facts are in the lorebook now. Re-extracting means
	// sending the page from the Crawler again, which re-stages it.
	for url := range approved {
		a.dropStagedSourceLocked(url)
	}
	return append([]lorebook.Entry{}, a.lorebookEntries...)
}

// GetLorebookSuggestions returns the connection proposals awaiting review.
func (a *App) GetLorebookSuggestions() []loreextract.Suggestion {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]loreextract.Suggestion{}, a.loreSuggestions...)
}

// SuggestLorebookConnections analyses the whole project and proposes the
// connections it is missing. Nothing is applied until the user approves.
func (a *App) SuggestLorebookConnections() ([]loreextract.Suggestion, error) {
	a.mu.Lock()
	req := loreextract.ConnectRequest{
		Entries:    append([]lorebook.Entry{}, a.lorebookEntries...),
		Characters: append([]compose.Character{}, a.characters...),
		Templates:  a.settings.PromptTemplates,
	}
	def := a.endpointForSlot(slotLoreConnect)
	a.mu.Unlock()

	if len(req.Entries) == 0 {
		return nil, fmt.Errorf("the lorebook is empty — there is nothing to connect yet")
	}
	if def.URL == "" {
		return nil, fmt.Errorf("no LLM endpoint configured")
	}
	req.Endpoint = toLLMEndpoint(def)

	suggestions, err := a.loreConn.Suggest(a.ctx, req)
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	a.loreSuggestions = suggestions
	a.mu.Unlock()
	return suggestions, nil
}

// ApplyLorebookSuggestions applies the selected connection proposals and
// returns the updated project state.
//
// Everything except a relationship rewrite is additive: keys and character
// scoping are merged in, never replaced, so approving a suggestion cannot
// discard work the user did by hand. Relationship text is replaced, which is
// why the review UI shows the current text next to the proposal.
func (a *App) ApplyLorebookSuggestions(suggestions []loreextract.Suggestion) CrawlSendResult {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, s := range suggestions {
		if !s.Selected {
			continue
		}
		switch s.Kind {
		case loreextract.KindEntryCharacter:
			a.updateEntryLocked(s.EntryUID, func(e *lorebook.Entry) {
				e.Characters = mergeUnique(e.Characters, s.AddCharacters)
			})
		case loreextract.KindTriggerKeys:
			a.updateEntryLocked(s.EntryUID, func(e *lorebook.Entry) {
				e.Key = mergeUnique(e.Key, s.AddKeys)
			})
		case loreextract.KindEntryEntry:
			a.updateEntryLocked(s.EntryUID, func(e *lorebook.Entry) {
				e.KeySecondary = mergeUnique(e.KeySecondary, s.AddSecondary)
			})
		case loreextract.KindCharacterCharacter:
			for i := range a.characters {
				if a.characters[i].ID == s.CharID {
					a.characters[i].Relationships = s.ProposedRelationships
					a.characters[i].Dirty = true
					break
				}
			}
		}
	}

	a.loreSuggestions = nil
	return CrawlSendResult{
		Characters:   a.characters,
		Lorebook:     a.lorebookEntries,
		Staged:       a.stagedSources,
		ActiveCharID: a.activeCharID,
	}
}

// updateEntryLocked applies fn to the entry with the given UID. Caller holds a.mu.
func (a *App) updateEntryLocked(uid int, fn func(*lorebook.Entry)) {
	for i := range a.lorebookEntries {
		if a.lorebookEntries[i].UID == uid {
			fn(&a.lorebookEntries[i])
			return
		}
	}
}

// stagedSourceLocked returns a staged source by page URL. Caller holds a.mu.
func (a *App) stagedSourceLocked(pageURL string) (loreextract.StagedSource, bool) {
	if i, ok := a.stagedSourceIndexLocked(pageURL); ok {
		return a.stagedSources[i], true
	}
	return loreextract.StagedSource{}, false
}

// mergeUnique appends the items of add not already in base, comparing
// case-insensitively so a differently-cased duplicate is not added twice.
func mergeUnique(base, add []string) []string {
	seen := make(map[string]bool, len(base))
	for _, b := range base {
		seen[normalizeKey(b)] = true
	}
	out := base
	for _, item := range add {
		key := normalizeKey(item)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		// Store the trimmed form: a key with stray whitespace matches nothing.
		out = append(out, strings.TrimSpace(item))
	}
	if out == nil {
		return []string{}
	}
	return out
}

func normalizeKey(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// extractionStateLocked captures the in-progress review for the bundle, or nil
// when there is nothing to save. Caller holds a.mu.
func (a *App) extractionStateLocked() *loreextract.State {
	st := loreextract.State{
		Sources:     append([]loreextract.StagedSource{}, a.stagedSources...),
		Candidates:  append([]loreextract.Candidate{}, a.loreCandidates...),
		Suggestions: append([]loreextract.Suggestion{}, a.loreSuggestions...),
	}
	if st.Empty() {
		return nil
	}
	return &st
}

// applyExtractionStateLocked restores the review from a loaded bundle. A bundle
// without one clears the state rather than leaking the previous project's
// staging into the newly opened one. Caller holds a.mu.
func (a *App) applyExtractionStateLocked(st *loreextract.State) {
	if st == nil {
		a.stagedSources, a.loreCandidates, a.loreSuggestions = nil, nil, nil
		return
	}
	a.stagedSources = st.Sources
	a.loreCandidates = st.Candidates
	a.loreSuggestions = st.Suggestions
}
