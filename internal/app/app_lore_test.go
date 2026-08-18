package app

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/loreextract"
	"silly-sleeve/internal/prompts"
	"silly-sleeve/internal/settings"
)

// newLoreApp builds an app with a crawl set, one character, and a configured
// endpoint, with the LLM seam replaced by the given canned response.
func newLoreApp(response string, err error) *App {
	a := newSendApp()
	a.settings = settings.Settings{
		Endpoints: []settings.LLMEndpoint{
			{ID: 1, Name: "local", URL: "http://local", Model: "m", IsDefault: true},
		},
		PromptTemplates: prompts.Defaults(),
	}
	a.characters = []compose.Character{{ID: 1, Name: "Alistair"}}
	a.activeCharID = 1

	completer := llm.CompleterFunc(func(context.Context, llm.LLMEndpoint, string, string) (string, error) {
		return response, err
	})
	a.loreGen = loreextract.NewExtractor(completer)
	a.loreConn = loreextract.NewConnector(completer)
	return a
}

const loreResponse = `{"entries":[
{"category":"location","comment":"Denerim","key":["Denerim","the capital"],
 "content":"Denerim sprawls along the coast.","order":320,"characters":["Alistair"]},
{"category":"concept","comment":"The Blight","key":["Blight","the Blight"],
 "content":"The Blight rises when an Old God wakes.","order":540}]}`

func stageLore(t *testing.T, a *App) {
	t.Helper()
	require.Equal(t, "staged", a.SendCrawlResult("https://w/wiki/Lore", "lorebook", false).Status)
}

func TestExtractLorebookCandidates_ReturnsCandidatesWithoutTouchingTheLorebook(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)

	got, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)
	require.Len(t, got, 2)

	assert.Empty(t, a.lorebookEntries, "extraction proposes; it must not write to the lorebook")
	assert.Len(t, a.GetLorebookCandidates(), 2)
	assert.True(t, a.stagedSources[0].Extracted)
	assert.Equal(t, []string{"1"}, got[0].Entry.Characters, "names resolve to character ids")
}

func TestExtractLorebookCandidates_ReplacesThePagesPreviousCandidates(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	a.loreCandidates = []loreextract.Candidate{{SourceURL: "https://w/wiki/Other"}}

	_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)

	// Two fresh ones for this page, plus the untouched candidate from another.
	assert.Len(t, a.loreCandidates, 3)

	_, err = a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)
	assert.Len(t, a.loreCandidates, 3, "re-extracting replaces rather than accumulates")
}

func TestExtractLorebookCandidates_Errors(t *testing.T) {
	t.Run("page not staged", func(t *testing.T) {
		a := newLoreApp(loreResponse, nil)
		_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not staged")
	})

	t.Run("page gone from the crawl", func(t *testing.T) {
		a := newLoreApp(loreResponse, nil)
		stageLore(t, a)
		a.cachedCrawlSet = nil

		_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no longer in the crawl")
	})

	t.Run("no endpoint configured", func(t *testing.T) {
		a := newLoreApp(loreResponse, nil)
		stageLore(t, a)
		a.settings.Endpoints = nil

		_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no LLM endpoint")
	})

	t.Run("llm failure propagates", func(t *testing.T) {
		a := newLoreApp("", errors.New("connection refused"))
		stageLore(t, a)

		_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "connection refused")
		assert.False(t, a.stagedSources[0].Extracted, "a failed extraction is not an extraction")
	})
}

func TestApproveLorebookCandidates_AddsOnlySelected(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	candidates, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)

	candidates[1].Selected = false
	entries := a.ApproveLorebookCandidates(candidates)

	require.Len(t, entries, 1)
	assert.Equal(t, "Denerim", entries[0].Comment)
	assert.Equal(t, "https://w/wiki/Lore", entries[0].SourceURL)
	assert.Empty(t, a.loreCandidates, "unticked candidates were rejected, not deferred")
}

func TestApproveLorebookCandidates_KeepsTheUsersEdits(t *testing.T) {
	// The user edits candidates in the review UI, so approval has to take them
	// back from the frontend rather than reading App state.
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	candidates, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)

	candidates[0].Entry.Comment = "Denerim, the capital"
	candidates[0].Entry.Key = []string{"Denerim", "Fort Drakon"}
	candidates[0].Entry.Category = lorebook.CategoryOrganization
	candidates[1].Selected = false

	entries := a.ApproveLorebookCandidates(candidates)

	require.Len(t, entries, 1)
	assert.Equal(t, "Denerim, the capital", entries[0].Comment)
	assert.Equal(t, []string{"Denerim", "Fort Drakon"}, entries[0].Key)
	assert.Equal(t, lorebook.CategoryOrganization, entries[0].Category)
}

func TestApproveLorebookCandidates_ConsumesTheStagedSource(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	candidates, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)

	candidates[1].Selected = false
	a.ApproveLorebookCandidates(candidates)

	assert.Empty(t, a.GetStagedSources(),
		"approval consumes the page's review, so it must not linger staged")
}

func TestApproveLorebookCandidates_NothingSelectedKeepsThePageStaged(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	candidates, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)

	for i := range candidates {
		candidates[i].Selected = false
	}
	a.ApproveLorebookCandidates(candidates)

	assert.Len(t, a.GetStagedSources(), 1, "nothing was approved, so the review is still open")
	assert.Len(t, a.GetLorebookCandidates(), 2)
}

func TestApproveLorebookCandidates_AssignsUniqueUIDs(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	a.lorebookEntries = []lorebook.Entry{{UID: 7, Comment: "Existing"}}
	stageLore(t, a)
	candidates, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)

	entries := a.ApproveLorebookCandidates(candidates)

	seen := map[int]bool{}
	for _, e := range entries {
		assert.False(t, seen[e.UID], "uid %d assigned twice", e.UID)
		seen[e.UID] = true
	}
	assert.Equal(t, []int{7, 8, 9}, []int{entries[0].UID, entries[1].UID, entries[2].UID})
}

func TestDiscardLorebookCandidates_LeavesThePageStaged(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)

	assert.Empty(t, a.DiscardLorebookCandidates("https://w/wiki/Lore"))
	require.Len(t, a.stagedSources, 1, "the page stays staged so it can be extracted again")
	assert.False(t, a.stagedSources[0].Extracted)
}

func TestStagedSourceBindings(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)

	assert.Len(t, a.GetStagedSources(), 1)

	got := a.SetStagedSourceMode("https://w/wiki/Lore", loreextract.ModeSummary)
	require.Len(t, got, 1)
	assert.Equal(t, loreextract.ModeSummary, got[0].Mode)

	got = a.SetStagedSourceMode("https://w/wiki/Lore", "nonsense")
	assert.Equal(t, loreextract.ModeSplit, got[0].Mode, "an unknown mode falls back to split")

	assert.Empty(t, a.SetStagedSourceMode("https://w/wiki/Missing", loreextract.ModeSummary)[0].URL == "")
	assert.Empty(t, a.RemoveStagedSource("https://w/wiki/Lore"))
}

func TestSetStagedSourceMode_ChoosesThePrompt(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	a.SetStagedSourceMode("https://w/wiki/Lore", loreextract.ModeSummary)

	got, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)
	assert.Len(t, got, 1, "summary mode yields a single entry")
}

func TestSetStagedSourceStyle(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)

	require.Len(t, a.GetStagedSources(), 1)
	assert.Equal(t, loreextract.StyleProse, a.GetStagedSources()[0].Style, "staging defaults to prose")

	got := a.SetStagedSourceStyle("https://w/wiki/Lore", loreextract.StyleFactual)
	require.Len(t, got, 1)
	assert.Equal(t, loreextract.StyleFactual, got[0].Style)

	got = a.SetStagedSourceStyle("https://w/wiki/Lore", "nonsense")
	assert.Equal(t, loreextract.StyleProse, got[0].Style, "an unknown style falls back to prose")

	got = a.SetStagedSourceStyle("https://w/wiki/Missing", loreextract.StyleFactual)
	assert.Equal(t, loreextract.StyleProse, got[0].Style, "a miss changes nothing")
}

func TestSetStagedSourceStyle_ChoosesTheWording(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	var captured string
	a.loreGen = loreextract.NewExtractor(llm.CompleterFunc(
		func(_ context.Context, _ llm.LLMEndpoint, _, user string) (string, error) {
			captured = user
			return loreResponse, nil
		}))
	stageLore(t, a)
	a.SetStagedSourceStyle("https://w/wiki/Lore", loreextract.StyleFactual)

	_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)
	assert.Contains(t, captured, "dense, factual", "the chosen style must reach the prompt")
}

const connectResponse = `{"suggestions":[
{"kind":"entryCharacter","entryUid":1,"addCharacters":["Alistair"],"rationale":"a"},
{"kind":"triggerKeys","entryUid":1,"addKeys":["the capital"],"rationale":"b"},
{"kind":"entryEntry","entryUid":1,"targetUid":2,"addSecondary":["Grey Warden"],"rationale":"c"}]}`

func newConnectApp(response string) *App {
	a := newLoreApp(response, nil)
	a.lorebookEntries = []lorebook.Entry{
		{UID: 1, Comment: "Denerim", Key: []string{"Denerim"}, Content: "The capital.", Characters: []string{}},
		{UID: 2, Comment: "Wardens", Key: []string{"Grey Warden"}, Content: "An order.", Characters: []string{}},
	}
	return a
}

func TestSuggestLorebookConnections(t *testing.T) {
	a := newConnectApp(connectResponse)

	got, err := a.SuggestLorebookConnections()
	require.NoError(t, err)
	assert.Len(t, got, 3)
	assert.Len(t, a.GetLorebookSuggestions(), 3)
}

func TestSuggestLorebookConnections_Errors(t *testing.T) {
	t.Run("empty lorebook", func(t *testing.T) {
		a := newLoreApp(connectResponse, nil)
		_, err := a.SuggestLorebookConnections()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "nothing to connect")
	})

	t.Run("no endpoint", func(t *testing.T) {
		a := newConnectApp(connectResponse)
		a.settings.Endpoints = nil
		_, err := a.SuggestLorebookConnections()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no LLM endpoint")
	})
}

func TestApplyLorebookSuggestions_MergesAdditively(t *testing.T) {
	a := newConnectApp(connectResponse)
	suggestions, err := a.SuggestLorebookConnections()
	require.NoError(t, err)

	out := a.ApplyLorebookSuggestions(suggestions)

	entry := out.Lorebook[0]
	assert.Equal(t, []string{"Denerim", "the capital"}, entry.Key, "existing keys survive")
	assert.Equal(t, []string{"1"}, entry.Characters)
	assert.Equal(t, []string{"Grey Warden"}, entry.KeySecondary)
	assert.Empty(t, a.GetLorebookSuggestions(), "applied suggestions are consumed")
}

func TestApplyLorebookSuggestions_SkipsUnselected(t *testing.T) {
	a := newConnectApp(connectResponse)
	suggestions, err := a.SuggestLorebookConnections()
	require.NoError(t, err)
	for i := range suggestions {
		suggestions[i].Selected = false
	}

	out := a.ApplyLorebookSuggestions(suggestions)

	assert.Equal(t, []string{"Denerim"}, out.Lorebook[0].Key, "nothing was approved")
	assert.Empty(t, out.Lorebook[0].Characters)
}

func TestApplyLorebookSuggestions_NeverDuplicatesExistingItems(t *testing.T) {
	a := newConnectApp(connectResponse)
	a.lorebookEntries[0].Key = []string{"Denerim", "The Capital"}

	out := a.ApplyLorebookSuggestions([]loreextract.Suggestion{
		{Kind: loreextract.KindTriggerKeys, EntryUID: 1, AddKeys: []string{"the capital"}, Selected: true},
	})

	assert.Equal(t, []string{"Denerim", "The Capital"}, out.Lorebook[0].Key,
		"a differently-cased duplicate must not be added")
}

func TestApplyLorebookSuggestions_ReplacesRelationshipText(t *testing.T) {
	a := newConnectApp(connectResponse)
	a.characters = []compose.Character{{ID: 1, Name: "Alistair", Relationships: "Wary of Loghain."}}

	out := a.ApplyLorebookSuggestions([]loreextract.Suggestion{{
		Kind: loreextract.KindCharacterCharacter, CharID: 1, TargetChar: 2,
		CurrentRelationships:  "Wary of Loghain.",
		ProposedRelationships: "Wary of Loghain. Mentored by Duncan.",
		Selected:              true,
	}})

	assert.Equal(t, "Wary of Loghain. Mentored by Duncan.", out.Characters[0].Relationships)
	assert.True(t, out.Characters[0].Dirty)
}

func TestApplyLorebookSuggestions_IgnoresUnknownTargets(t *testing.T) {
	a := newConnectApp(connectResponse)

	out := a.ApplyLorebookSuggestions([]loreextract.Suggestion{
		{Kind: loreextract.KindTriggerKeys, EntryUID: 99, AddKeys: []string{"x"}, Selected: true},
		{Kind: loreextract.KindCharacterCharacter, CharID: 99, ProposedRelationships: "x", Selected: true},
		{Kind: "unknown", EntryUID: 1, Selected: true},
	})

	assert.Equal(t, []string{"Denerim"}, out.Lorebook[0].Key)
	assert.Equal(t, "", out.Characters[0].Relationships)
}

func TestExtractionState_RoundTripsThroughABundle(t *testing.T) {
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.NoError(t, err)
	a.loreSuggestions = []loreextract.Suggestion{{Kind: loreextract.KindTriggerKeys, EntryUID: 1}}

	path := t.TempDir() + "/project.slv"
	require.NoError(t, a.SaveProjectBundle(path))

	reopened := newLoreApp(loreResponse, nil)
	reopened.project = a.project
	_, err = reopened.OpenProjectBundle(path)
	require.NoError(t, err)

	require.Len(t, reopened.stagedSources, 1, "a half-finished review must survive save and reopen")
	assert.Equal(t, "https://w/wiki/Lore", reopened.stagedSources[0].URL)
	assert.True(t, reopened.stagedSources[0].Extracted)
	assert.Len(t, reopened.loreCandidates, 2)
	assert.Len(t, reopened.loreSuggestions, 1)
}

func TestExtractionState_BundleWithoutOneClearsPreviousStaging(t *testing.T) {
	// Opening a project must not leak the previous project's staging.
	clean := newLoreApp(loreResponse, nil)
	path := t.TempDir() + "/clean.slv"
	require.NoError(t, clean.SaveProjectBundle(path))

	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)
	a.project = clean.project

	_, err := a.OpenProjectBundle(path)
	require.NoError(t, err)

	assert.Empty(t, a.stagedSources)
	assert.Empty(t, a.loreCandidates)
	assert.Empty(t, a.loreSuggestions)
}

func TestMergeUnique(t *testing.T) {
	// The first spelling of a new item wins, trimmed; later case variants and
	// anything already present are dropped.
	assert.Equal(t, []string{"a", "B"}, mergeUnique([]string{"a"}, []string{"B ", "b", "a", " "}))
	assert.Equal(t, []string{}, mergeUnique(nil, nil))
	assert.Equal(t, []string{"x"}, mergeUnique(nil, []string{"x"}))
}

func TestLoreEndpointSlots(t *testing.T) {
	// A project can point extraction at a different model from the rest.
	a := newLoreApp(loreResponse, nil)
	a.settings.Endpoints = append(a.settings.Endpoints,
		settings.LLMEndpoint{ID: 2, Name: "big", URL: "http://big", Model: "b"})
	a.fieldEndpoints = map[string]int{slotLoreExtract: 2}

	assert.Equal(t, 2, a.endpointForSlot(slotLoreExtract).ID)
	assert.Equal(t, 1, a.endpointForSlot(slotLoreConnect).ID, "unset slots fall back to the default")
}

func TestCrawlResultStillReachableForExtraction(t *testing.T) {
	// Guards the assumption ExtractLorebookCandidates relies on: the staged
	// page's text is read from the crawl set, not stored on the source.
	a := newLoreApp(loreResponse, nil)
	stageLore(t, a)

	res, ok := a.crawlResultByURLLocked("https://w/wiki/Lore")
	require.True(t, ok)
	assert.Equal(t, "Lore", res.Title)
	assert.IsType(t, crawler.CrawlResult{}, res)
}
