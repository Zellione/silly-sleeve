// Package loreextract turns crawled wiki pages into candidate lorebook entries
// and proposes the connections between them.
//
// It exists as a separate package from lorebook so that lorebook stays a pure
// data package: cardexport and cardimport already depend on it, and they have
// no business pulling in an HTTP client, a crawler and a tokenizer.
//
// Nothing here writes to the project. Extraction and connection analysis both
// produce proposals — Candidates and Suggestions — which the user reviews and
// edits before anything is applied. That is the whole point: the previous
// crawl-to-lorebook path wrote entries directly and produced unusable ones.
package loreextract

import (
	"silly-sleeve/internal/lorebook"
)

// ExtractionMode selects how much a page is broken up.
type ExtractionMode string

const (
	// ModeSplit produces many atomic entries, one concept each.
	ModeSplit ExtractionMode = "split"
	// ModeSummary produces a single entry covering the whole page.
	ModeSummary ExtractionMode = "summary"
)

// Valid reports whether the mode is one this package understands.
func (m ExtractionMode) Valid() bool {
	return m == ModeSplit || m == ModeSummary
}

// OrDefault returns the mode, or ModeSplit when it is unset or unrecognised.
func (m ExtractionMode) OrDefault() ExtractionMode {
	if m.Valid() {
		return m
	}
	return ModeSplit
}

// StagedSource is a crawled page queued for extraction. Sending a crawl to the
// lorebook creates one of these rather than an entry: what a page should become
// is a judgement the user makes after seeing the extracted facts.
type StagedSource struct {
	URL       string         `json:"url"`
	Title     string         `json:"title"`
	Mode      ExtractionMode `json:"mode"`
	Extracted bool           `json:"extracted"`
}

// Candidate is a proposed lorebook entry awaiting review.
type Candidate struct {
	Entry     lorebook.Entry `json:"entry"`
	SourceURL string         `json:"sourceUrl"`
	// Adjustments records what the normaliser corrected, so the user sees the
	// changes instead of the model being silently overridden.
	Adjustments []string `json:"adjustments"`
	// Selected is UI state, round-tripped through the frontend so approval can
	// send back exactly what the user ticked.
	Selected bool `json:"selected"`
}

// Suggestion kinds.
const (
	// KindEntryCharacter scopes an entry to the characters it concerns.
	KindEntryCharacter = "entryCharacter"
	// KindTriggerKeys adds keywords to an entry that cannot currently be reached.
	KindTriggerKeys = "triggerKeys"
	// KindEntryEntry links two entries by giving one the other's key as a
	// secondary key, so SillyTavern's recursion chains them.
	KindEntryEntry = "entryEntry"
	// KindCharacterCharacter records a relationship in a character's
	// relationships text.
	KindCharacterCharacter = "characterCharacter"
)

// Suggestion is a proposed connection. Every kind is additive except
// characterCharacter, which replaces prose — and that one carries the current
// text alongside the proposal so the user can see what would change.
type Suggestion struct {
	Kind string `json:"kind"`

	EntryUID   int `json:"entryUid,omitempty"`
	TargetUID  int `json:"targetUid,omitempty"`
	CharID     int `json:"charId,omitempty"`
	TargetChar int `json:"targetCharId,omitempty"`

	AddKeys       []string `json:"addKeys,omitempty"`
	AddSecondary  []string `json:"addSecondary,omitempty"`
	AddCharacters []string `json:"addCharacters,omitempty"`

	// CurrentRelationships and ProposedRelationships apply to
	// KindCharacterCharacter only. The proposal is the complete replacement
	// text, editable in review — a character's relationships prose may be
	// hand-written, and appending a fragment blindly would mangle it.
	CurrentRelationships  string `json:"currentRelationships,omitempty"`
	ProposedRelationships string `json:"proposedRelationships,omitempty"`

	Rationale string `json:"rationale"`
	Selected  bool   `json:"selected"`
}

// State is the reviewable work in progress, persisted with the project so a
// half-finished review survives a save and reopen.
type State struct {
	Sources     []StagedSource `json:"sources"`
	Candidates  []Candidate    `json:"candidates"`
	Suggestions []Suggestion   `json:"suggestions"`
}

// Empty reports whether there is nothing worth persisting.
func (s State) Empty() bool {
	return len(s.Sources) == 0 && len(s.Candidates) == 0 && len(s.Suggestions) == 0
}
