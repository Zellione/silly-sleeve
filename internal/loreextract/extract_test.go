package loreextract

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/prompts"
)

// fakeCompleter returns a canned response and captures what it was asked.
type fakeCompleter struct {
	response  string
	err       error
	system    string
	user      string
	endpoint  llm.LLMEndpoint
	callCount int
}

func (f *fakeCompleter) Complete(_ context.Context, ep llm.LLMEndpoint, system, user string) (string, error) {
	f.callCount++
	f.system, f.user, f.endpoint = system, user, ep
	return f.response, f.err
}

func testCrawl() crawler.CrawlResult {
	return crawler.CrawlResult{
		Title: "Ferelden",
		URL:   "https://dragonage.fandom.com/wiki/Ferelden",
		Sections: []crawler.Section{
			{Heading: "Geography", Body: "A rugged kingdom of bannorn and bog."},
		},
	}
}

func testCharacters() []compose.Character {
	return []compose.Character{
		{ID: 1, Name: "Alistair", Epithet: "The Reluctant King"},
		{ID: 2, Name: "Duncan"},
	}
}

func extractWith(t *testing.T, response string, req ExtractRequest) ([]Candidate, error) {
	t.Helper()
	f := &fakeCompleter{response: response}
	return NewExtractor(f).Extract(context.Background(), req)
}

func baseRequest() ExtractRequest {
	return ExtractRequest{
		Crawl:      testCrawl(),
		Mode:       ModeSplit,
		Endpoint:   llm.LLMEndpoint{URL: "http://local", Model: "m"},
		Characters: testCharacters(),
		Templates:  prompts.Defaults(),
	}
}

const twoEntryResponse = `{"entries":[
{"category":"location","comment":"Denerim","key":["Denerim","the capital"],
 "content":"Denerim sprawls along the coast, smoke and salt on the wind.","order":320,"characters":["1"]},
{"category":"concept","comment":"The Blight","key":["Blight","the Blight"],
 "content":"The Blight rises when an Old God wakes beneath the earth.","order":540,"characters":[]}]}`

func TestExtract_ParsesEntries(t *testing.T) {
	got, err := extractWith(t, twoEntryResponse, baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 2)

	assert.Equal(t, "Denerim", got[0].Entry.Comment)
	assert.Equal(t, lorebook.CategoryLocation, got[0].Entry.Category)
	assert.Equal(t, []string{"Denerim", "the capital"}, got[0].Entry.Key)
	assert.Equal(t, 320, got[0].Entry.Order)
	assert.Equal(t, "The Blight", got[1].Entry.Comment)
}

func TestExtract_StampsSourceURLAndSelectsByDefault(t *testing.T) {
	got, err := extractWith(t, twoEntryResponse, baseRequest())
	require.NoError(t, err)

	for _, c := range got {
		assert.Equal(t, testCrawl().URL, c.SourceURL)
		assert.Equal(t, testCrawl().URL, c.Entry.SourceURL)
		assert.True(t, c.Selected, "candidates start selected so approving is one click")
	}
}

func TestExtract_AppliesNormalisation(t *testing.T) {
	// position and preventRecursion are ours to set, and a generic keyword must
	// be dropped even though the model produced it.
	resp := `{"entries":[{"category":"character","comment":"Alistair",
"key":["Alistair","king"],"content":"A templar who never wanted a throne.","order":300}]}`

	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 1)

	assert.Equal(t, lorebook.PositionAfterCharDefs, got[0].Entry.Position)
	assert.True(t, got[0].Entry.PreventRecursion)
	assert.Equal(t, []string{"Alistair"}, got[0].Entry.Key)
	assert.NotEmpty(t, got[0].Adjustments, "corrections must be reported, not silent")
}

func TestExtract_ConstantBudgetAccountsForExistingEntries(t *testing.T) {
	req := baseRequest()
	req.Existing = []lorebook.Entry{{UID: 1, Constant: true}, {UID: 2, Constant: true}, {UID: 3, Constant: true}}

	resp := `{"entries":[{"category":"rule","comment":"No resurrection",
"key":["resurrection","raise the dead"],"content":"Magic cannot raise the dead.","order":950}]}`

	got, err := extractWith(t, resp, req)
	require.NoError(t, err)
	assert.False(t, got[0].Entry.Constant, "the lorebook is already at the always-on limit")
}

func TestExtract_ResolvesCharacterNamesToIDs(t *testing.T) {
	// The prompt asks for IDs, but models reason in names. Entry.Characters
	// holds ID strings, so a name left unmapped would scope the entry to nobody.
	resp := `{"entries":[{"category":"location","comment":"Redcliffe",
"key":["Redcliffe","the castle"],"content":"A fortress above a lake.","order":300,
"characters":["Alistair","2"]}]}`

	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	assert.Equal(t, []string{"1", "2"}, got[0].Entry.Characters)
	assert.Empty(t, got[0].Adjustments)
}

func TestExtract_CharacterMatchingIsCaseInsensitive(t *testing.T) {
	resp := `{"entries":[{"category":"location","comment":"Redcliffe","key":["Redcliffe","the castle"],
"content":"A fortress.","order":300,"characters":["  ALISTAIR  "]}]}`

	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	assert.Equal(t, []string{"1"}, got[0].Entry.Characters)
}

func TestExtract_ReportsUnresolvableCharacters(t *testing.T) {
	resp := `{"entries":[{"category":"location","comment":"Redcliffe","key":["Redcliffe","the castle"],
"content":"A fortress.","order":300,"characters":["Morrigan","99","Alistair"]}]}`

	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)

	assert.Equal(t, []string{"1"}, got[0].Entry.Characters, "only the real character survives")

	var note string
	for _, a := range got[0].Adjustments {
		if strings.Contains(a, "Could not match") {
			note = a
		}
	}
	require.NotEmpty(t, note, "unmatched references must be reported: %v", got[0].Adjustments)
	assert.Contains(t, note, "Morrigan")
	assert.Contains(t, note, "99")
}

func TestExtract_DeduplicatesCharacterRefs(t *testing.T) {
	resp := `{"entries":[{"category":"location","comment":"Redcliffe","key":["Redcliffe","the castle"],
"content":"A fortress.","order":300,"characters":["Alistair","1","alistair"]}]}`

	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	assert.Equal(t, []string{"1"}, got[0].Entry.Characters)
}

func TestExtract_ToleratesMarkdownFences(t *testing.T) {
	for _, fence := range []string{"```json\n%s\n```", "```\n%s\n```"} {
		wrapped := strings.Replace(fence, "%s", twoEntryResponse, 1)
		got, err := extractWith(t, wrapped, baseRequest())
		require.NoError(t, err, "fence %q", fence)
		assert.Len(t, got, 2)
	}
}

func TestExtract_ToleratesSurroundingProse(t *testing.T) {
	resp := "Here are the entries you asked for:\n" + twoEntryResponse + "\nLet me know if you need more."

	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	assert.Len(t, got, 2)
}

func TestExtract_ToleratesTopLevelArray(t *testing.T) {
	// Local models drift between {"entries":[...]} and a bare array of the same
	// objects run to run, so the parser accepts both shapes.
	arr := strings.TrimSuffix(strings.TrimPrefix(twoEntryResponse, `{"entries":`), "}")
	for name, resp := range map[string]string{
		"bare":  arr,
		"fence": "```json\n" + arr + "\n```",
		"prose": "Here are the entries you asked for:\n" + arr + "\nLet me know if you need more.",
	} {
		got, err := extractWith(t, resp, baseRequest())
		require.NoError(t, err, name)
		assert.Len(t, got, 2, name)
	}
}

func TestExtract_RepairsMalformedJSONWithoutRetry(t *testing.T) {
	// Trailing comma plus a literal newline in content: the two most common
	// small-model defects. Repair must fix them without a second request.
	resp := "{\"entries\": [{\"category\": \"location\", \"comment\": \"Ferelden\", " +
		"\"key\": [\"ferelden\"], \"content\": \"line one\nline two\", \"order\": 300,}]}"

	f := &fakeCompleter{response: resp}
	got, err := NewExtractor(f).Extract(context.Background(), baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, 1, f.callCount, "repair must not cost a second request")
	assert.Equal(t, "line one\nline two", got[0].Entry.Content)
	assert.Contains(t, strings.Join(got[0].Adjustments, " "), "repair")
}

func TestExtract_RetriesOnceWithErrorFeedback(t *testing.T) {
	f := &scriptedCompleter{responses: []string{"I cannot produce JSON, sorry.", twoEntryResponse}}
	got, err := NewExtractor(f).Extract(context.Background(), baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 2)
	require.Len(t, f.prompts, 2)
	assert.Contains(t, f.prompts[1], "I cannot produce JSON, sorry.", "retry shows the model its bad reply")
	assert.Contains(t, strings.Join(got[0].Adjustments, " "), "retr")
}

func TestExtract_ToleratesOrderAsString(t *testing.T) {
	// Small models emit "order": "300"; a type mismatch there must not kill
	// the whole batch.
	resp := `{"entries":[{"category":"location","comment":"Redcliffe","key":["Redcliffe","the castle"],
"content":"A fortress.","order":"300"}]}`

	got, err := extractWith(t, resp, baseRequest())
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, 300, got[0].Entry.Order)
}

func TestExtract_MalformedJSONErrorsWithContext(t *testing.T) {
	_, err := extractWith(t, "not json at all", baseRequest())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse extraction response")
}

func TestExtract_EmptyEntryListIsAnError(t *testing.T) {
	_, err := extractWith(t, `{"entries":[]}`, baseRequest())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no entries")
}

func TestExtract_PropagatesCompleterError(t *testing.T) {
	f := &fakeCompleter{err: errors.New("connection refused")}
	_, err := NewExtractor(f).Extract(context.Background(), baseRequest())

	require.Error(t, err)
	assert.Contains(t, err.Error(), "llm complete")
	assert.Contains(t, err.Error(), "connection refused")
}

func TestExtract_SummaryModeKeepsOnlyOneEntry(t *testing.T) {
	req := baseRequest()
	req.Mode = ModeSummary

	got, err := extractWith(t, twoEntryResponse, req)
	require.NoError(t, err)
	assert.Len(t, got, 1, "summary mode produces a single entry even if the model over-produces")
	assert.Equal(t, "Denerim", got[0].Entry.Comment)
}

func TestExtract_ModeSelectsThePrompt(t *testing.T) {
	tests := []struct {
		mode ExtractionMode
		want string
	}{
		{ModeSplit, "Extract atomic lorebook entries"},
		{ModeSummary, "SINGLE lorebook entry"},
		{ExtractionMode("nonsense"), "Extract atomic lorebook entries"},
		{"", "Extract atomic lorebook entries"},
	}

	for _, tc := range tests {
		t.Run(string(tc.mode), func(t *testing.T) {
			f := &fakeCompleter{response: twoEntryResponse}
			req := baseRequest()
			req.Mode = tc.mode

			_, err := NewExtractor(f).Extract(context.Background(), req)
			require.NoError(t, err)
			assert.Contains(t, f.user, tc.want)
		})
	}
}

func TestExtract_PromptCarriesProjectContext(t *testing.T) {
	f := &fakeCompleter{response: twoEntryResponse}
	req := baseRequest()
	req.Existing = []lorebook.Entry{{UID: 7, Comment: "Grey Wardens", Key: []string{"Warden", "Grey Warden"}}}

	_, err := NewExtractor(f).Extract(context.Background(), req)
	require.NoError(t, err)

	assert.Contains(t, f.user, "1 · Alistair · The Reluctant King", "roster must reach the prompt")
	assert.Contains(t, f.user, "7 · Grey Wardens · Warden, Grey Warden", "entry index must reach the prompt")
	assert.Contains(t, f.user, "A rugged kingdom of bannorn and bog.", "page text must reach the prompt")
	assert.NotContains(t, f.user, "{{", "every placeholder must be substituted")
}

func TestExtract_UsesTheLorebookSystemPrompt(t *testing.T) {
	f := &fakeCompleter{response: twoEntryResponse}
	_, err := NewExtractor(f).Extract(context.Background(), baseRequest())
	require.NoError(t, err)

	assert.Contains(t, f.system, "world info",
		"lorebook work must not be framed with the character-card system prompt")
	assert.NotContains(t, f.system, "character card creator")
}

func TestExtract_BackfillsMissingTemplates(t *testing.T) {
	// A project saved before lore prompts existed has none; WithDefaults should
	// fill them rather than failing the extraction.
	req := baseRequest()
	req.Templates = prompts.TemplateSet{}

	got, err := extractWith(t, twoEntryResponse, req)
	require.NoError(t, err)
	assert.Len(t, got, 2)
}

func TestExtract_MissingTemplateIsAnError(t *testing.T) {
	req := baseRequest()
	req.Templates = prompts.TemplateSet{
		SystemPrompt: "x",
		FieldPrompts: map[string]string{},
		LorePrompts:  map[string]string{prompts.LoreExtractSplit: "   "},
	}

	_, err := extractWith(t, twoEntryResponse, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no template")
}

func TestExtract_PassesTheEndpointThrough(t *testing.T) {
	f := &fakeCompleter{response: twoEntryResponse}
	req := baseRequest()
	req.Endpoint = llm.LLMEndpoint{URL: "http://elsewhere", Model: "big"}

	_, err := NewExtractor(f).Extract(context.Background(), req)
	require.NoError(t, err)
	assert.Equal(t, "http://elsewhere", f.endpoint.URL)
	assert.Equal(t, "big", f.endpoint.Model)
	assert.Equal(t, 1, f.callCount)
}

func TestNewExtractor_NilCompleterFallsBackToDefault(t *testing.T) {
	assert.NotNil(t, NewExtractor(nil).completerOrDefault())
}

func TestExtractionMode(t *testing.T) {
	assert.True(t, ModeSplit.Valid())
	assert.True(t, ModeSummary.Valid())
	assert.False(t, ExtractionMode("").Valid())
	assert.False(t, ExtractionMode("other").Valid())

	assert.Equal(t, ModeSummary, ModeSummary.OrDefault())
	assert.Equal(t, ModeSplit, ExtractionMode("").OrDefault())
	assert.Equal(t, ModeSplit, ExtractionMode("other").OrDefault())
}

func TestState_Empty(t *testing.T) {
	assert.True(t, State{}.Empty())
	assert.False(t, State{Sources: []StagedSource{{URL: "u"}}}.Empty())
	assert.False(t, State{Candidates: []Candidate{{}}}.Empty())
	assert.False(t, State{Suggestions: []Suggestion{{}}}.Empty())
}

func TestBuildCharacterRoster(t *testing.T) {
	assert.Equal(t, "(none)", buildCharacterRoster(nil))

	got := buildCharacterRoster([]compose.Character{
		{ID: 1, Name: "Alistair", Epithet: "The Reluctant King"},
		{ID: 2, Name: "Duncan"},
		{ID: 3},
	})
	assert.Equal(t, "1 · Alistair · The Reluctant King\n2 · Duncan\n3 · Character 3", got)
}

func TestBuildEntryIndex(t *testing.T) {
	assert.Equal(t, "(none)", buildEntryIndex(nil))

	got := buildEntryIndex([]lorebook.Entry{
		{UID: 1, Comment: "Denerim", Key: []string{"Denerim", "the capital"}},
		{UID: 2, Key: []string{"Blight"}},
	})
	assert.Equal(t, "1 · Denerim · Denerim, the capital\n2 · (untitled) · Blight", got)
}

func TestBuildFocusEntries(t *testing.T) {
	assert.Equal(t, "(none)", buildFocusEntries(nil))

	got := buildFocusEntries([]lorebook.Entry{{
		UID: 4, Comment: "Redcliffe", Category: lorebook.CategoryLocation,
		Key: []string{"Redcliffe"}, KeySecondary: []string{"the castle"},
		Characters: []string{"1"}, Content: "A fortress above a lake.",
	}})

	assert.Contains(t, got, "uid 4 · Redcliffe")
	assert.Contains(t, got, "category: location")
	assert.Contains(t, got, "keys: Redcliffe")
	assert.Contains(t, got, "secondary keys: the castle")
	assert.Contains(t, got, "scoped to characters: 1")
	assert.Contains(t, got, "content: A fortress above a lake.")
}

func TestBuildFocusEntries_EmptyListsRenderAsNone(t *testing.T) {
	got := buildFocusEntries([]lorebook.Entry{{UID: 1, Comment: "X", Content: "y"}})
	assert.Contains(t, got, "keys: (none)")
	assert.Contains(t, got, "scoped to characters: (none)")
}

func TestTruncate(t *testing.T) {
	assert.Equal(t, "abc", truncate("abc", 5))
	assert.Equal(t, "abc", truncate("abc", 3))
	assert.Equal(t, "ab…", truncate("abcdef", 2))
}
