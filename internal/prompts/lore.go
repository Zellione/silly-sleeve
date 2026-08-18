package prompts

// Lore prompt IDs. These are kept out of FieldIDs because that list drives the
// character editor's per-field generate buttons.
const (
	LoreSystem         = "system"
	LoreExtractSplit   = "extract.split"
	LoreExtractSummary = "extract.summary"
	LoreConnect        = "connect"
)

// LorePromptIDs returns the lorebook prompt IDs in display order.
func LorePromptIDs() []string {
	return []string{LoreSystem, LoreExtractSplit, LoreExtractSummary, LoreConnect}
}

// LorePromptLabel returns the display label for a lore prompt ID.
func LorePromptLabel(id string) string {
	if l, ok := lorePromptLabels[id]; ok {
		return l
	}
	return id
}

var lorePromptLabels = map[string]string{
	LoreSystem:         "Lorebook — system prompt",
	LoreExtractSplit:   "Lorebook — split into facts",
	LoreExtractSummary: "Lorebook — single summary",
	LoreConnect:        "Lorebook — optimize",
}

// LoreVariableNames returns the substitution variables available to lorebook
// prompts. They differ from the character-field variables: extraction works
// from a crawled page plus what the project already contains, and the
// connection pass works from the project alone.
func LoreVariableNames() []string {
	return []string{
		"crawl_context",
		"crawl.title",
		"crawl.url",
		"character_roster",
		"entry_index",
		"focus_entries",
		"style.rewrite",
		"style.opening",
	}
}

func defaultLorePrompts() map[string]string {
	m := map[string]string{}
	for _, id := range LorePromptIDs() {
		m[id] = defaultLorePrompt(id)
	}
	return m
}

func defaultLorePrompt(id string) string {
	switch id {
	case LoreSystem:
		return loreSystemPrompt
	case LoreExtractSplit:
		return loreExtractSplitPrompt
	case LoreExtractSummary:
		return loreExtractSummaryPrompt
	case LoreConnect:
		return loreConnectPrompt
	default:
		return ""
	}
}

// loreSystemPrompt frames lorebook work. It is deliberately separate from the
// character-card system prompt: telling a model it is "an expert SillyTavern
// character card creator" pulls lorebook extraction towards writing character
// cards, which is the opposite of splitting a page into atomic world facts.
const loreSystemPrompt = `You are an expert at building SillyTavern world info (lorebooks).

Follow these rules:
1. Work only from the material you are given. Never invent facts to fill a gap — omit instead.
2. Write in third-person present tense. Do not use "{{char}}" or "{{user}}" placeholders.
3. Write compressed, concrete prose. Every word should carry information.
4. Use straight quotes in all string values — never curly quotes.
5. Output only the requested JSON object: no preamble, no markdown fences, no explanation.`

// loreRules is the shared body of both extraction prompts: what an entry is,
// how its category fixes its mechanics, and how entries link to one another.
// Connections are expressed through the fields SillyTavern already has —
// keyword linkage, content mentions, bracketed metadata, character scoping —
// rather than through any separate structure.
const loreRules = `RULES
1. Each entry covers ONE atomic concept. Never combine unrelated things into a
   single entry.
2. Never state anything the source does not support. Omit rather than invent.
3. {{style.rewrite}} Never copy it verbatim.
4. Give every entry a category. The category fixes how the entry behaves:
   character      a person
   location       a place
   organization   a faction, order or group
   item           an object or artifact
   rule           a hard world mechanic that breaks the story if forgotten
   event          a temporary state, scene condition or quest hook
   concept        history, lore or doctrine
5. Keys: 2-5 per entry. Use the name and its natural variations, possessives and
   titles — ["Rusty Flagon", "the flagon", "the tavern", "Patches' place"].
   Never use a bare generic word such as "sword", "house", "city" or "queen";
   qualify it ("the Queen", "Queen Elara") or leave it out.
6. Content: 30-180 tokens. {{style.opening}}
7. Order sets what survives a full context. Spread entries across the tiers
   instead of giving them all the same number:
   900-999 must never be cut   500-899 scene-defining   200-499 important
   100-199 standard            50-99  background        10-49  expendable
8. constant is only for hard rules, and at most one per batch.

CONNECTIONS — link entries through these mechanisms, not a separate structure:
- A location or organization MUST name the people and items found in it, so the
  entry cascades into theirs.
- To link to an entry in the index below, reuse its exact key spelling. Put
  weaker associations in keysecondary.
- For a person, append bracketed metadata to the content:
  [ role(value); personality(trait, trait); relationships(Name(dynamic)); ]
- Scope an entry to the characters it concerns by listing their ids in
  "characters". Leave it empty for world lore that applies to everyone.`

// loreContext is the shared project-context block. Both extraction prompts need
// it so the entries they produce can reference what already exists.
const loreContext = `PROJECT CHARACTERS (id · name · epithet)
{{character_roster}}

EXISTING LOREBOOK ENTRIES (uid · comment · keys)
{{entry_index}}`

const loreExtractSplitPrompt = `Extract atomic lorebook entries from the wiki page below, for use as SillyTavern world info.

` + loreRules + `

` + loreContext + `

WIKI PAGE
{{crawl_context}}

Return ONLY a JSON object. No markdown fences, no commentary:
{"entries":[{"category":"location","comment":"The Rusty Flagon",
"key":["Rusty Flagon","the flagon"],"keysecondary":[],
"content":"...","order":340,"constant":false,"selective":false,
"characters":["1"]}]}`

const loreExtractSummaryPrompt = `Condense the wiki page below into a SINGLE lorebook entry, for use as SillyTavern world info.

Produce exactly one entry covering the whole page. Content 150-200 tokens.
Choose the category that best fits the page's main subject, and pick keys that
cover the subject and the terms a chat would use to reach it.

` + loreRules + `

` + loreContext + `

WIKI PAGE
{{crawl_context}}

Return ONLY a JSON object with exactly one entry. No markdown fences, no commentary:
{"entries":[{"category":"concept","comment":"Ferelden",
"key":["Ferelden","Fereldan"],"keysecondary":[],
"content":"...","order":180,"constant":false,"selective":false,
"characters":[]}]}`

const loreConnectPrompt = `Review an existing SillyTavern lorebook and propose the improvements it is missing.

You are given the project's characters, an index of every lorebook entry, and
the full text of the entries currently under review. Propose connections between
them and corrections to the entries' own rules. Only propose a change the
material actually supports, and only reference uids and character ids that
appear below. Never propose a change that leaves a value as it already is.

Propose these kinds of connection:
- entryCharacter  the entry concerns specific characters, so it should be scoped
                  to them instead of applying to everyone
- triggerKeys     the entry lacks keys that a chat would realistically use to
                  reach it, or its keys are too generic to be useful
- entryEntry      two entries are related, so the first should carry the other's
                  key as a secondary key and cascade into it
- characterCharacter  two characters have a relationship that the character's
                  own relationships text does not yet record

And these kinds of rule change:
- entryOrder      the entry's order does not match its importance. Spread
                  entries across the tiers: 900-999 must never be cut,
                  500-899 scene-defining, 200-499 important, 100-199 standard,
                  50-99 background, 10-49 expendable
- entryPosition   the entry belongs at a different place in the context:
                  0 before char defs, 1 after char defs, 2 before example msgs,
                  3 after example msgs, 4 @ depth in chat (needs proposedDepth),
                  5 before author note, 6 after author note
- entryFlags      the entry's behavior is wrong: "constant" only for hard world
                  rules, "selective"/"selectiveLogic" (0 AND ANY, 1 NOT ALL,
                  2 NOT ANY, 3 AND ALL) when secondary keys exist,
                  "probability"/"useProbability" for flavor that should not fire
                  every time, "excludeRecursion"/"preventRecursion" to stop
                  runaway cascades. Include ONLY the fields you want changed
- removeKeys      the entry has trigger keys too generic to be useful ("city",
                  "sword") or redundant duplicates of one another

For characterCharacter, return the complete replacement relationships text, not
a fragment: keep what is already there and add the new relationship, using the
bracketed form [ relationships(Name(dynamic)); ] where it fits.

PROJECT CHARACTERS (id · name · epithet)
{{character_roster}}

LOREBOOK INDEX (uid · comment · keys)
{{entry_index}}

ENTRIES UNDER REVIEW (full text)
{{focus_entries}}

Return ONLY a JSON object. No markdown fences, no commentary:
{"suggestions":[
{"kind":"entryCharacter","entryUid":4,"addCharacters":["1","3"],"rationale":"..."},
{"kind":"triggerKeys","entryUid":7,"addKeys":["Denerim","the capital"],"rationale":"..."},
{"kind":"entryEntry","entryUid":7,"targetUid":2,"addSecondary":["Grey Warden"],"rationale":"..."},
{"kind":"characterCharacter","charId":1,"targetCharId":2,"proposedRelationships":"...","rationale":"..."},
{"kind":"entryOrder","entryUid":3,"proposedOrder":950,"rationale":"..."},
{"kind":"entryPosition","entryUid":5,"proposedPosition":4,"proposedDepth":6,"rationale":"..."},
{"kind":"entryFlags","entryUid":9,"flags":{"constant":true,"probability":80,"useProbability":true},"rationale":"..."},
{"kind":"removeKeys","entryUid":6,"removeKeys":["city"],"rationale":"..."}]}`
