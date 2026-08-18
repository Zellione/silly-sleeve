package loreextract

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/jsonrepair"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/prompts"
)

// defaultContextTokens is assumed when an endpoint does not declare its context
// size, which is common for local servers.
const defaultContextTokens = 8192

// Connector analyses a whole project and proposes the connections it is
// missing: entries that should be scoped to characters, entries that should
// link to one another, entries nothing can trigger, and relationships absent
// from a character's prose.
type Connector struct {
	completer llm.Completer
}

// NewConnector returns a Connector using the given completer, or the production
// HTTP-backed one when it is nil.
func NewConnector(completer llm.Completer) *Connector {
	return &Connector{completer: completer}
}

func (c *Connector) completerOrDefault() llm.Completer {
	if c.completer != nil {
		return c.completer
	}
	return llm.DefaultCompleter
}

// ConnectRequest is the input to a connection pass.
type ConnectRequest struct {
	Entries    []lorebook.Entry
	Characters []compose.Character
	Endpoint   llm.LLMEndpoint
	Templates  prompts.TemplateSet
}

type suggestionResponse struct {
	Suggestions []suggestionPayload `json:"suggestions"`
}

type suggestionPayload struct {
	Kind                  string       `json:"kind"`
	EntryUID              int          `json:"entryUid"`
	TargetUID             int          `json:"targetUid"`
	CharID                int          `json:"charId"`
	TargetCharID          int          `json:"targetCharId"`
	AddKeys               []string     `json:"addKeys"`
	AddSecondary          []string     `json:"addSecondary"`
	AddCharacters         []string     `json:"addCharacters"`
	ProposedRelationships string       `json:"proposedRelationships"`
	ProposedOrder         *int         `json:"proposedOrder"`
	ProposedPosition      *int         `json:"proposedPosition"`
	ProposedDepth         *int         `json:"proposedDepth"`
	Flags                 *FlagChanges `json:"flags"`
	RemoveKeys            []string     `json:"removeKeys"`
	Rationale             string       `json:"rationale"`
}

// Suggest runs the connection pass and returns deduplicated suggestions.
//
// A lorebook can easily outgrow an endpoint's context, so entries are analysed
// in batches sized by token budget. Every batch carries the full character
// roster and an index of every entry — uid, comment and keys only — alongside
// the full text of just that batch. The index is what lets a batch propose a
// link to an entry whose text it cannot see: to connect to an entry the model
// reuses that entry's exact key spelling.
func (c *Connector) Suggest(ctx context.Context, req ConnectRequest) ([]Suggestion, error) {
	if len(req.Entries) == 0 {
		return nil, nil
	}

	tpl := req.Templates.WithDefaults()
	template := tpl.LorePrompts[prompts.LoreConnect]
	if strings.TrimSpace(template) == "" {
		return nil, fmt.Errorf("no template for lore prompt %s", prompts.LoreConnect)
	}

	roster := buildCharacterRoster(req.Characters)
	index := buildEntryIndex(req.Entries)
	render := func(focus string) string {
		return prompts.Substitute(template, map[string]string{
			"character_roster": roster,
			"entry_index":      index,
			"focus_entries":    focus,
		})
	}

	available := contextBudget(req.Endpoint) - compose.CountTokens(render(""))
	if available <= 0 {
		return nil, fmt.Errorf(
			"lorebook is too large for this endpoint: the character roster and entry index alone need about %d tokens, but the endpoint's context is %d — raise the context size or split the project",
			compose.CountTokens(render("")), contextBudget(req.Endpoint))
	}

	var (
		all      []Suggestion
		firstErr error
		ok       int
	)
	for _, batch := range batchEntries(req.Entries, available) {
		payloads, _, err := llm.CompleteJSON(ctx, c.completerOrDefault(), req.Endpoint,
			tpl.LorePrompts[prompts.LoreSystem], render(buildFocusEntries(batch)), parseSuggestions)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		ok++
		all = append(all, validSuggestions(payloads, req)...)
	}

	// One bad batch should not discard the work of the others; only a pass that
	// achieved nothing at all is a failure.
	if ok == 0 && firstErr != nil {
		return nil, firstErr
	}
	return dedupeSuggestions(all), nil
}

// contextBudget is the endpoint's usable token budget, holding back a quarter
// for the model's own reply.
func contextBudget(ep llm.LLMEndpoint) int {
	size := ep.ContextSize
	if size <= 0 {
		size = defaultContextTokens
	}
	return size - size/4
}

// batchEntries groups entries into batches whose rendered text fits the budget.
// An entry too large to fit on its own is still sent alone: dropping it would
// silently exclude it from the analysis.
func batchEntries(entries []lorebook.Entry, budget int) [][]lorebook.Entry {
	var (
		batches [][]lorebook.Entry
		current []lorebook.Entry
		used    int
	)

	for _, e := range entries {
		cost := compose.CountTokens(buildFocusEntries([]lorebook.Entry{e}))
		if len(current) > 0 && used+cost > budget {
			batches = append(batches, current)
			current, used = nil, 0
		}
		current = append(current, e)
		used += cost
	}
	if len(current) > 0 {
		batches = append(batches, current)
	}
	return batches
}

func parseSuggestions(content string) ([]suggestionPayload, error) {
	cleaned := jsonrepair.Clean(content)

	var resp suggestionResponse
	err := json.Unmarshal([]byte(cleaned), &resp)
	if err != nil || len(resp.Suggestions) == 0 {
		// Same shape drift as extraction: the model may answer with a bare
		// array instead of the {"suggestions":[...]} wrapper.
		var arr []suggestionPayload
		if json.Unmarshal([]byte(cleaned), &arr) == nil {
			resp.Suggestions, err = arr, nil
		}
	}
	if err != nil {
		return nil, fmt.Errorf("parse connection response: %w (got: %s)", err, truncate(cleaned, 200))
	}
	return resp.Suggestions, nil
}

// validSuggestions drops anything that cannot be applied: unknown uids and
// character ids, unrecognised kinds, and proposals that would change nothing.
// A suggestion pointing at something that does not exist is worse than no
// suggestion, because the user has to work out why approving it did nothing.
func validSuggestions(payloads []suggestionPayload, req ConnectRequest) []Suggestion {
	entries := make(map[int]lorebook.Entry, len(req.Entries))
	for _, e := range req.Entries {
		entries[e.UID] = e
	}
	chars := make(map[int]compose.Character, len(req.Characters))
	for _, c := range req.Characters {
		chars[c.ID] = c
	}

	out := make([]Suggestion, 0, len(payloads))
	for _, p := range payloads {
		s, ok := buildSuggestion(p, entries, chars, req.Characters)
		if ok {
			out = append(out, s)
		}
	}
	return out
}

// buildSuggestion dispatches to the builder for the proposal's kind. Each
// builder returns false when its proposal cannot be applied or would change
// nothing, and the caller drops it.
func buildSuggestion(p suggestionPayload, entries map[int]lorebook.Entry, chars map[int]compose.Character, roster []compose.Character) (Suggestion, bool) {
	s := Suggestion{Kind: p.Kind, Rationale: strings.TrimSpace(p.Rationale), Selected: true}

	switch p.Kind {
	case KindEntryCharacter:
		return buildEntryCharacter(s, p, entries, roster)
	case KindTriggerKeys:
		return buildTriggerKeys(s, p, entries)
	case KindEntryEntry:
		return buildEntryEntry(s, p, entries)
	case KindCharacterCharacter:
		return buildCharacterCharacter(s, p, chars)
	case KindEntryOrder:
		return buildEntryOrder(s, p, entries)
	case KindEntryPosition:
		return buildEntryPosition(s, p, entries)
	case KindEntryFlags:
		return buildEntryFlags(s, p, entries)
	case KindRemoveKeys:
		return buildRemoveKeys(s, p, entries)
	default:
		return s, false
	}
}

// buildEntryCharacter scopes an entry to characters it is not already scoped to.
func buildEntryCharacter(s Suggestion, p suggestionPayload, entries map[int]lorebook.Entry, roster []compose.Character) (Suggestion, bool) {
	entry, ok := entries[p.EntryUID]
	if !ok {
		return s, false
	}
	ids, _ := resolveCharacterRefs(p.AddCharacters, roster)
	ids = missingItems(ids, entry.Characters)
	if len(ids) == 0 {
		return s, false
	}
	s.EntryUID, s.AddCharacters = p.EntryUID, ids
	return s, true
}

// buildTriggerKeys adds keywords an entry cannot currently be reached by.
func buildTriggerKeys(s Suggestion, p suggestionPayload, entries map[int]lorebook.Entry) (Suggestion, bool) {
	entry, ok := entries[p.EntryUID]
	if !ok {
		return s, false
	}
	keys := missingItems(usableKeys(p.AddKeys), entry.Key)
	if len(keys) == 0 {
		return s, false
	}
	s.EntryUID, s.AddKeys = p.EntryUID, keys
	return s, true
}

// buildEntryEntry gives one entry another's key as a secondary key, so
// SillyTavern's recursion chains them.
func buildEntryEntry(s Suggestion, p suggestionPayload, entries map[int]lorebook.Entry) (Suggestion, bool) {
	entry, ok := entries[p.EntryUID]
	if !ok {
		return s, false
	}
	if _, ok := entries[p.TargetUID]; !ok || p.TargetUID == p.EntryUID {
		return s, false
	}
	secondary := missingItems(usableKeys(p.AddSecondary), entry.KeySecondary)
	if len(secondary) == 0 {
		return s, false
	}
	s.EntryUID, s.TargetUID, s.AddSecondary = p.EntryUID, p.TargetUID, secondary
	return s, true
}

// buildCharacterCharacter records a relationship in a character's prose. The
// current text travels with the proposal because applying it replaces rather
// than merges.
func buildCharacterCharacter(s Suggestion, p suggestionPayload, chars map[int]compose.Character) (Suggestion, bool) {
	source, ok := chars[p.CharID]
	if !ok {
		return s, false
	}
	if _, ok := chars[p.TargetCharID]; !ok || p.TargetCharID == p.CharID {
		return s, false
	}
	proposed := strings.TrimSpace(p.ProposedRelationships)
	if proposed == "" || proposed == strings.TrimSpace(source.Relationships) {
		return s, false
	}
	s.CharID, s.TargetChar = p.CharID, p.TargetCharID
	s.CurrentRelationships = source.Relationships
	s.ProposedRelationships = proposed
	return s, true
}

// Bounds for proposed rule values. Order tiers top out at 999 in the prompt,
// but SillyTavern accepts up to 1000; positions and selective logic mirror the
// editor's own ranges.
const (
	maxOrder          = 1000
	maxPosition       = 6
	maxDepth          = 64
	maxSelectiveLogic = 3
	positionAtDepth   = 4
)

// buildEntryOrder re-tiers an entry's activation order.
func buildEntryOrder(s Suggestion, p suggestionPayload, entries map[int]lorebook.Entry) (Suggestion, bool) {
	entry, ok := entries[p.EntryUID]
	if !ok || p.ProposedOrder == nil {
		return s, false
	}
	order := *p.ProposedOrder
	if order < 0 || order > maxOrder || order == entry.Order {
		return s, false
	}
	s.EntryUID, s.CurrentOrder, s.ProposedOrder = p.EntryUID, entry.Order, order
	return s, true
}

// buildEntryPosition moves an entry to a different injection position. Depth
// only matters at the @Depth position; a proposal that omits it keeps the
// entry's own depth, so approving never resets a hand-tuned value.
func buildEntryPosition(s Suggestion, p suggestionPayload, entries map[int]lorebook.Entry) (Suggestion, bool) {
	entry, ok := entries[p.EntryUID]
	if !ok || p.ProposedPosition == nil {
		return s, false
	}
	position := *p.ProposedPosition
	if position < 0 || position > maxPosition {
		return s, false
	}
	depth := entry.Depth
	if p.ProposedDepth != nil && *p.ProposedDepth >= 0 && *p.ProposedDepth <= maxDepth {
		depth = *p.ProposedDepth
	}
	if position == entry.Position && (position != positionAtDepth || depth == entry.Depth) {
		return s, false
	}
	s.EntryUID = p.EntryUID
	s.CurrentPosition, s.ProposedPosition = entry.Position, position
	s.CurrentDepth, s.ProposedDepth = entry.Depth, depth
	return s, true
}

// buildEntryFlags adjusts behavior flags, keeping only the fields that both
// pass validation and actually differ from the entry's current values.
func buildEntryFlags(s Suggestion, p suggestionPayload, entries map[int]lorebook.Entry) (Suggestion, bool) {
	entry, ok := entries[p.EntryUID]
	if !ok || p.Flags == nil {
		return s, false
	}

	var current, proposed FlagChanges
	changed := false
	keepBool := func(want *bool, have bool, cur, prop **bool) {
		if want == nil || *want == have {
			return
		}
		*cur, *prop = ptrTo(have), ptrTo(*want)
		changed = true
	}
	keepInt := func(want *int, have, limit int, cur, prop **int) {
		if want == nil || *want == have || *want < 0 || *want > limit {
			return
		}
		*cur, *prop = ptrTo(have), ptrTo(*want)
		changed = true
	}

	keepBool(p.Flags.Constant, entry.Constant, &current.Constant, &proposed.Constant)
	keepBool(p.Flags.Selective, entry.Selective, &current.Selective, &proposed.Selective)
	keepInt(p.Flags.SelectiveLogic, entry.SelectiveLogic, maxSelectiveLogic, &current.SelectiveLogic, &proposed.SelectiveLogic)
	keepInt(p.Flags.Probability, entry.Probability, 100, &current.Probability, &proposed.Probability)
	keepBool(p.Flags.UseProbability, entry.UseProbability, &current.UseProbability, &proposed.UseProbability)
	keepBool(p.Flags.ExcludeRecursion, entry.ExcludeRecursion, &current.ExcludeRecursion, &proposed.ExcludeRecursion)
	keepBool(p.Flags.PreventRecursion, entry.PreventRecursion, &current.PreventRecursion, &proposed.PreventRecursion)

	if !changed {
		return s, false
	}
	s.EntryUID, s.CurrentFlags, s.ProposedFlags = p.EntryUID, &current, &proposed
	return s, true
}

// buildRemoveKeys drops trigger keys from an entry. The suggestion carries the
// entry's own spelling of each key, and a non-constant entry must keep at
// least one — an entry nothing can trigger is worse than a noisy one.
func buildRemoveKeys(s Suggestion, p suggestionPayload, entries map[int]lorebook.Entry) (Suggestion, bool) {
	entry, ok := entries[p.EntryUID]
	if !ok {
		return s, false
	}

	wanted := make(map[string]bool, len(p.RemoveKeys))
	for _, k := range p.RemoveKeys {
		wanted[strings.ToLower(strings.TrimSpace(k))] = true
	}
	var remove []string
	for _, k := range entry.Key {
		if wanted[strings.ToLower(strings.TrimSpace(k))] {
			remove = append(remove, k)
		}
	}
	if len(remove) == 0 {
		return s, false
	}
	if !entry.Constant && len(remove) == len(entry.Key) {
		return s, false
	}
	s.EntryUID, s.RemoveKeys = p.EntryUID, remove
	return s, true
}

func ptrTo[T any](v T) *T {
	return &v
}

// usableKeys drops blanks and keywords too generic to be worth triggering on,
// using the same stoplist the normaliser applies to extracted entries.
func usableKeys(keys []string) []string {
	out := make([]string, 0, len(keys))
	for _, k := range keys {
		k = strings.TrimSpace(k)
		if k == "" || lorebook.IsGenericKey(k) {
			continue
		}
		out = append(out, k)
	}
	return out
}

// missingItems returns the items of want not already present in have, compared
// case-insensitively, so a suggestion that adds nothing is never shown.
func missingItems(want, have []string) []string {
	existing := make(map[string]bool, len(have))
	for _, h := range have {
		existing[strings.ToLower(strings.TrimSpace(h))] = true
	}

	out := make([]string, 0, len(want))
	for _, w := range want {
		key := strings.ToLower(strings.TrimSpace(w))
		if key == "" || existing[key] {
			continue
		}
		existing[key] = true
		out = append(out, w)
	}
	return out
}

// dedupeSuggestions collapses proposals repeated across batches, which happens
// whenever two batches both notice the same relationship.
func dedupeSuggestions(suggestions []Suggestion) []Suggestion {
	seen := make(map[string]bool, len(suggestions))
	out := make([]Suggestion, 0, len(suggestions))

	for _, s := range suggestions {
		key := strings.Join([]string{
			s.Kind,
			strconv.Itoa(s.EntryUID),
			strconv.Itoa(s.TargetUID),
			strconv.Itoa(s.CharID),
			strconv.Itoa(s.TargetChar),
		}, "|")
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, s)
	}

	if len(out) == 0 {
		return nil
	}
	return out
}
