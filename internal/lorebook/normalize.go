package lorebook

import (
	"fmt"
	"sort"
	"strings"
)

// Normalisation limits drawn from the lorebook spec.
const (
	// MinKeys is the fewest keywords an entry needs to fire reliably. Falling
	// below it is reported, not corrected — inventing keywords is the model's
	// job, not ours.
	MinKeys = 2
	// MaxKeys caps keywords per entry; surplus keys dilute the trigger.
	MaxKeys = 5
	// MaxContentTokens is the point past which content is flagged for review.
	MaxContentTokens = 200
	// MaxConstants caps always-present entries across the whole lorebook.
	MaxConstants = 3
	// RulePrefix marks rule entries as imperative world mechanics.
	RulePrefix = "RULE: "
)

// TokenCounter estimates the token length of a string. Normalize uses it only
// to flag oversized content, so an approximation is adequate. Keeping it an
// injectable function is what lets this package stay free of the tokenizer —
// and therefore of the llm and crawler dependencies that come with it — while
// callers that already have a real tokenizer can supply one.
type TokenCounter func(string) int

// estimateTokens is the fallback counter: roughly four characters per token,
// matching what the real tokenizer degrades to when its encoding is missing.
func estimateTokens(s string) int { return len(s) / 4 }

// NormalizeResult pairs a corrected entry with the adjustments made to it, so
// the review UI can show the user what was changed rather than silently
// overriding the model.
type NormalizeResult struct {
	Entry       Entry    `json:"entry"`
	Adjustments []string `json:"adjustments"`
}

// Normalize coerces model-produced entries to the lorebook spec.
//
// Local models routinely ignore instructions — they cluster every order on 100,
// emit bare "sword" as a keyword, and set selective with no secondary keys — so
// the prompt is never the enforcement mechanism. This is. Mechanical settings
// implied by an entry's category are forced; judgement calls (too few keywords,
// overlong content) are reported and left for the user to resolve.
//
// existingConstants is the number of constant entries already in the lorebook,
// counted towards MaxConstants.
func Normalize(entries []Entry, existingConstants int) []NormalizeResult {
	return NormalizeWith(entries, existingConstants, estimateTokens)
}

// NormalizeWith is Normalize with an explicit token counter.
func NormalizeWith(entries []Entry, existingConstants int, count TokenCounter) []NormalizeResult {
	if count == nil {
		count = estimateTokens
	}

	results := make([]NormalizeResult, len(entries))
	constants := existingConstants

	for i, e := range entries {
		var adj []string

		e.Category, adj = normalizeCategory(e.Category, adj)
		settings, _ := CategoryDefaults(e.Category)

		e, adj = applyCategorySettings(e, settings, adj)
		e, adj, constants = applyConstant(e, settings, constants, adj)
		e, adj = normalizeKeys(e, adj)
		e, adj = normalizeSelective(e, adj)
		e, adj = normalizeContent(e, count, adj)
		e, adj = normalizeOrder(e, settings, adj)
		e = backfillDefaults(e)

		results[i] = NormalizeResult{Entry: e, Adjustments: adj}
	}

	return redistributeClusteredOrders(results)
}

// normalizeCategory coerces an unrecognised or missing category to the default.
func normalizeCategory(category string, adj []string) (string, []string) {
	trimmed := strings.ToLower(strings.TrimSpace(category))
	if _, ok := CategoryDefaults(trimmed); ok {
		return trimmed, adj
	}
	if trimmed == "" {
		return DefaultCategory, append(adj, fmt.Sprintf("No category given; treated as %s.", DefaultCategory))
	}
	return DefaultCategory, append(adj,
		fmt.Sprintf("Unrecognised category %q; treated as %s.", category, DefaultCategory))
}

// applyCategorySettings forces the insertion position and recursion behaviour
// implied by the category. These are not the model's to choose: they follow
// mechanically from what the entry describes.
func applyCategorySettings(e Entry, s CategorySettings, adj []string) (Entry, []string) {
	if e.Position != s.Position {
		adj = append(adj, fmt.Sprintf("Position %d → %d (required for %s entries).",
			e.Position, s.Position, e.Category))
		e.Position = s.Position
	}
	if e.PreventRecursion != s.PreventRecursion {
		adj = append(adj, fmt.Sprintf("Recursion prevention %v → %v (required for %s entries).",
			e.PreventRecursion, s.PreventRecursion, e.Category))
		e.PreventRecursion = s.PreventRecursion
	}
	return e, adj
}

// IsCategoryMandated reports whether an adjustment message records a
// category-mandated setting (position, recursion prevention) rather than a
// correction of something the model chose. The extraction prompt never asks
// for these fields, so these adjustments fire mechanically for most
// categories and say nothing about the quality of the model's output.
func IsCategoryMandated(adj string) bool {
	if !strings.Contains(adj, "(required for") {
		return false
	}
	return strings.HasPrefix(adj, "Position ") || strings.HasPrefix(adj, "Recursion prevention ")
}

// applyConstant forces constant to the category default, then enforces the
// lorebook-wide cap. Returns the running constant count.
func applyConstant(e Entry, s CategorySettings, constants int, adj []string) (Entry, []string, int) {
	if e.Constant != s.Constant {
		adj = append(adj, fmt.Sprintf("Always-on %v → %v (%s entries are %s).",
			e.Constant, s.Constant, e.Category, constantWord(s.Constant)))
		e.Constant = s.Constant
	}
	if !e.Constant {
		return e, adj, constants
	}
	if constants >= MaxConstants {
		e.Constant = false
		return e, append(adj, fmt.Sprintf(
			"Always-on turned off: the lorebook already has %d always-on entries (limit %d).",
			constants, MaxConstants)), constants
	}
	return e, adj, constants + 1
}

func constantWord(constant bool) string {
	if constant {
		return "always on"
	}
	return "keyword-triggered"
}

// normalizeKeys drops empty, duplicate and generic keywords, and caps the
// count. Entries left with too few keys are reported rather than repaired —
// an entry with no keys can never fire, and the user needs to know that.
func normalizeKeys(e Entry, adj []string) (Entry, []string) {
	e.Key, adj = cleanKeyList(e.Key, "keyword", adj)
	e.KeySecondary, adj = cleanKeyList(e.KeySecondary, "secondary keyword", adj)

	switch {
	case len(e.Key) == 0:
		adj = append(adj, "No usable keywords — this entry can never trigger. Add some before approving.")
	case len(e.Key) < MinKeys:
		adj = append(adj, fmt.Sprintf("Only %d keyword; %d or more trigger more reliably.", len(e.Key), MinKeys))
	}
	return e, adj
}

func cleanKeyList(keys []string, label string, adj []string) ([]string, []string) {
	out := make([]string, 0, len(keys))
	seen := make(map[string]bool, len(keys))
	var generic []string

	for _, k := range keys {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		lower := strings.ToLower(k)
		if seen[lower] {
			continue
		}
		if isGenericKey(lower) {
			generic = append(generic, k)
			continue
		}
		seen[lower] = true
		out = append(out, k)
	}

	if len(generic) > 0 {
		adj = append(adj, fmt.Sprintf("Dropped generic %s: %s.", label+"s", strings.Join(generic, ", ")))
	}
	if len(out) > MaxKeys {
		adj = append(adj, fmt.Sprintf("Kept the first %d of %d %ss.", MaxKeys, len(out), label))
		out = out[:MaxKeys]
	}
	return out, adj
}

// IsGenericKey reports whether a keyword is too generic to be a useful trigger.
// Exported so proposed keywords can be filtered against the same stoplist the
// normaliser uses, rather than a second copy of it.
func IsGenericKey(key string) bool {
	return isGenericKey(strings.ToLower(strings.TrimSpace(key)))
}

// isGenericKey reports whether a keyword is too generic to be a useful trigger.
// Only single words are ever rejected: the spec treats bare "queen" as generic
// but "the Queen" and "Queen Elara" as valid, and qualifying a word is exactly
// what makes it specific enough to match on.
func isGenericKey(lowered string) bool {
	if strings.ContainsAny(lowered, " \t-'’") {
		return false
	}
	return genericKeys[lowered]
}

// genericKeys are single words that match far too much prose to be triggers.
var genericKeys = map[string]bool{
	// Stopwords and pronouns.
	"the": true, "a": true, "an": true, "and": true, "or": true, "of": true,
	"in": true, "on": true, "at": true, "to": true, "is": true, "it": true,
	"he": true, "she": true, "they": true, "this": true, "that": true,
	// Generic people.
	"man": true, "woman": true, "boy": true, "girl": true, "child": true,
	"people": true, "person": true, "men": true, "women": true, "family": true,
	"group": true, "friend": true, "enemy": true,
	// Bare titles and roles. The qualified forms ("the Queen", "Queen Elara")
	// are multi-word and pass; it is the unqualified noun that fires on every
	// passing mention of anyone holding the role.
	"king": true, "queen": true, "prince": true, "princess": true,
	"lord": true, "lady": true, "knight": true, "captain": true,
	"guard": true, "soldier": true, "priest": true, "god": true, "goddess": true,
	// Generic places and things.
	"place": true, "thing": true, "city": true, "town": true, "village": true,
	"house": true, "home": true, "room": true, "door": true, "building": true,
	"land": true, "world": true, "area": true, "region": true, "country": true,
	// Generic objects.
	"sword": true, "blade": true, "weapon": true, "armor": true, "armour": true,
	"shield": true, "book": true, "map": true, "tool": true, "item": true,
	// Generic abstractions.
	"time": true, "day": true, "night": true, "name": true, "story": true,
	"event": true, "history": true, "life": true, "death": true, "work": true,
}

// normalizeSelective clears the selective flag when there are no secondary
// keywords to select on, which would otherwise make the entry unreachable.
func normalizeSelective(e Entry, adj []string) (Entry, []string) {
	if e.Selective && len(e.KeySecondary) == 0 {
		e.Selective = false
		adj = append(adj, "Selective turned off: it needs secondary keywords, and there are none.")
	}
	return e, adj
}

// normalizeContent trims content, applies the rule prefix, and flags anything
// over the token ceiling. Overlong content is never truncated — cutting a
// sentence in half is worse than an oversized entry, and the user can see the
// flag and decide.
func normalizeContent(e Entry, count TokenCounter, adj []string) (Entry, []string) {
	e.Content = strings.TrimSpace(e.Content)
	e.Comment = strings.TrimSpace(e.Comment)

	// SillyTavern shows the comment as the entry's memo, so an untitled entry
	// hurts there as much as in the review UI. The first key is the entry's
	// primary name and makes a serviceable title.
	if e.Comment == "" && len(e.Key) > 0 {
		e.Comment = e.Key[0]
		adj = append(adj, "No title from the model — used the first key as the title.")
	}

	if e.Category == CategoryRule && e.Content != "" && !strings.HasPrefix(e.Content, RulePrefix) {
		e.Content = RulePrefix + e.Content
		adj = append(adj, "Added the \"RULE: \" prefix required for rule entries.")
	}

	if e.Content == "" {
		return e, append(adj, "Empty content.")
	}
	if n := count(e.Content); n > MaxContentTokens {
		adj = append(adj, fmt.Sprintf("Content is about %d tokens, over the %d-token guideline — trim it before approving.",
			n, MaxContentTokens))
	}
	return e, adj
}

// normalizeOrder pulls an out-of-range order back onto the category's default
// tier. Orders already inside a tier are left alone; spreading them out is
// handled across the whole batch by redistributeClusteredOrders.
func normalizeOrder(e Entry, s CategorySettings, adj []string) (Entry, []string) {
	if _, ok := TierFor(e.Order); ok {
		return e, adj
	}
	target := s.DefaultTier.Mid()
	adj = append(adj, fmt.Sprintf("Order %d → %d (outside every priority tier; moved to %s).",
		e.Order, target, s.DefaultTier.Name))
	e.Order = target
	return e, adj
}

// backfillDefaults fills in the settings a model routinely omits, and replaces
// nil slices with empty ones so they marshal as [] rather than null.
func backfillDefaults(e Entry) Entry {
	if e.Probability == 0 {
		e.Probability = 100
	}
	if e.Depth == 0 {
		e.Depth = 4
	}
	e.UseProbability = true
	e.AddMemo = true

	if e.Key == nil {
		e.Key = []string{}
	}
	if e.KeySecondary == nil {
		e.KeySecondary = []string{}
	}
	if e.Characters == nil {
		e.Characters = []string{}
	}
	return e
}

// redistributeClusteredOrders spreads orders out when the batch has collapsed
// onto a single value — the characteristic failure where a model stamps every
// entry with 100, destroying the priority signal that decides what survives a
// full context. Affected entries are moved to their category's tier and fanned
// out inside it, so the redistribution follows what the entries actually are.
func redistributeClusteredOrders(results []NormalizeResult) []NormalizeResult {
	if len(results) < 3 {
		return results
	}

	counts := make(map[int]int, len(results))
	for _, r := range results {
		counts[r.Entry.Order]++
	}

	clustered := -1
	for order, n := range counts {
		if n*2 > len(results) {
			clustered = order
			break
		}
	}
	if clustered == -1 {
		return results
	}

	byTier := make(map[string][]int)
	for i, r := range results {
		if r.Entry.Order != clustered {
			continue
		}
		s, _ := CategoryDefaults(r.Entry.Category)
		byTier[s.DefaultTier.Name] = append(byTier[s.DefaultTier.Name], i)
	}

	for _, tier := range Tiers() {
		idxs := byTier[tier.Name]
		if len(idxs) == 0 {
			continue
		}
		sort.Ints(idxs)
		step := (tier.Max - tier.Min) / (len(idxs) + 1)
		for n, i := range idxs {
			order := tier.Max - (n+1)*step
			results[i].Adjustments = append(results[i].Adjustments, fmt.Sprintf(
				"Order %d → %d: every entry shared one order, which leaves nothing to prioritise. Spread across the %s tier.",
				clustered, order, tier.Name))
			results[i].Entry.Order = order
		}
	}

	return results
}

// CountConstants returns the number of always-on entries in a lorebook, for
// passing to Normalize as existingConstants.
func CountConstants(entries []Entry) int {
	n := 0
	for _, e := range entries {
		if e.Constant {
			n++
		}
	}
	return n
}
