package loreextract

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/prompts"
)

// scriptedCompleter returns a different response per call and records prompts.
type scriptedCompleter struct {
	responses []string
	err       error
	prompts   []string
}

func (s *scriptedCompleter) Complete(_ context.Context, _ llm.LLMEndpoint, _, user string) (string, error) {
	s.prompts = append(s.prompts, user)
	if s.err != nil {
		return "", s.err
	}
	i := len(s.prompts) - 1
	if i >= len(s.responses) {
		i = len(s.responses) - 1
	}
	return s.responses[i], nil
}

func connectRequest(entries []lorebook.Entry) ConnectRequest {
	return ConnectRequest{
		Entries:    entries,
		Characters: testCharacters(),
		Endpoint:   llm.LLMEndpoint{URL: "http://local", Model: "m", ContextSize: 8192},
		Templates:  prompts.Defaults(),
	}
}

func testEntries() []lorebook.Entry {
	return []lorebook.Entry{
		{UID: 1, Comment: "Denerim", Key: []string{"Denerim"}, Content: "The capital.", Characters: []string{}},
		{UID: 2, Comment: "Grey Wardens", Key: []string{"Grey Warden"}, Content: "An order.", Characters: []string{}},
	}
}

func suggestWith(t *testing.T, response string, req ConnectRequest) ([]Suggestion, error) {
	t.Helper()
	return NewConnector(&scriptedCompleter{responses: []string{response}}).Suggest(context.Background(), req)
}

func TestSuggest_NoEntriesIsANoOp(t *testing.T) {
	got, err := NewConnector(&scriptedCompleter{}).Suggest(context.Background(), connectRequest(nil))
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestSuggest_ParsesEveryKind(t *testing.T) {
	resp := `{"suggestions":[
{"kind":"entryCharacter","entryUid":1,"addCharacters":["Alistair"],"rationale":"he rules there"},
{"kind":"triggerKeys","entryUid":1,"addKeys":["the capital"],"rationale":"nothing reaches it"},
{"kind":"entryEntry","entryUid":1,"targetUid":2,"addSecondary":["Grey Warden"],"rationale":"wardens muster there"},
{"kind":"characterCharacter","charId":1,"targetCharId":2,"proposedRelationships":"Mentored by Duncan.","rationale":"duncan recruited him"}]}`

	got, err := suggestWith(t, resp, connectRequest(testEntries()))
	require.NoError(t, err)
	require.Len(t, got, 4)

	assert.Equal(t, KindEntryCharacter, got[0].Kind)
	assert.Equal(t, []string{"1"}, got[0].AddCharacters, "names must resolve to ids")
	assert.Equal(t, KindTriggerKeys, got[1].Kind)
	assert.Equal(t, []string{"the capital"}, got[1].AddKeys)
	assert.Equal(t, KindEntryEntry, got[2].Kind)
	assert.Equal(t, 2, got[2].TargetUID)
	assert.Equal(t, KindCharacterCharacter, got[3].Kind)
	assert.Equal(t, "Mentored by Duncan.", got[3].ProposedRelationships)

	for _, s := range got {
		assert.True(t, s.Selected)
		assert.NotEmpty(t, s.Rationale)
	}
}

func TestSuggest_CharacterRelationshipCarriesCurrentText(t *testing.T) {
	// The user must see what would be replaced: relationships prose may be
	// hand-written, and the proposal overwrites it wholesale.
	req := connectRequest(testEntries())
	req.Characters = []compose.Character{
		{ID: 1, Name: "Alistair", Relationships: "Wary of Loghain."},
		{ID: 2, Name: "Duncan"},
	}
	resp := `{"suggestions":[{"kind":"characterCharacter","charId":1,"targetCharId":2,
"proposedRelationships":"Wary of Loghain. Mentored by Duncan.","rationale":"x"}]}`

	got, err := suggestWith(t, resp, req)
	require.NoError(t, err)
	require.Len(t, got, 1)

	assert.Equal(t, "Wary of Loghain.", got[0].CurrentRelationships)
	assert.Equal(t, "Wary of Loghain. Mentored by Duncan.", got[0].ProposedRelationships)
}

func TestSuggest_DropsSuggestionsPointingAtNothing(t *testing.T) {
	tests := []struct {
		name string
		resp string
	}{
		{"unknown entry", `{"suggestions":[{"kind":"triggerKeys","entryUid":99,"addKeys":["x"]}]}`},
		{"unknown target entry", `{"suggestions":[{"kind":"entryEntry","entryUid":1,"targetUid":99,"addSecondary":["x"]}]}`},
		{"entry linked to itself", `{"suggestions":[{"kind":"entryEntry","entryUid":1,"targetUid":1,"addSecondary":["x"]}]}`},
		{"unknown character", `{"suggestions":[{"kind":"characterCharacter","charId":98,"targetCharId":99,"proposedRelationships":"x"}]}`},
		{"character linked to itself", `{"suggestions":[{"kind":"characterCharacter","charId":1,"targetCharId":1,"proposedRelationships":"x"}]}`},
		{"unknown kind", `{"suggestions":[{"kind":"telepathy","entryUid":1}]}`},
		{"empty relationship text", `{"suggestions":[{"kind":"characterCharacter","charId":1,"targetCharId":2,"proposedRelationships":"  "}]}`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := suggestWith(t, tc.resp, connectRequest(testEntries()))
			require.NoError(t, err)
			assert.Empty(t, got, "a suggestion that cannot be applied must not be shown")
		})
	}
}

func TestSuggest_DropsNoOpSuggestions(t *testing.T) {
	entries := []lorebook.Entry{{
		UID: 1, Comment: "Denerim", Key: []string{"Denerim"},
		KeySecondary: []string{"Grey Warden"}, Characters: []string{"1"}, Content: "x",
	}, {UID: 2, Comment: "Wardens", Key: []string{"Grey Warden"}, Content: "y"}}

	tests := []struct {
		name string
		resp string
	}{
		{"character already scoped", `{"suggestions":[{"kind":"entryCharacter","entryUid":1,"addCharacters":["1"]}]}`},
		{"key already present", `{"suggestions":[{"kind":"triggerKeys","entryUid":1,"addKeys":["denerim"]}]}`},
		{"secondary already present", `{"suggestions":[{"kind":"entryEntry","entryUid":1,"targetUid":2,"addSecondary":["grey warden"]}]}`},
		{"only generic keys", `{"suggestions":[{"kind":"triggerKeys","entryUid":1,"addKeys":["city","the"]}]}`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := suggestWith(t, tc.resp, connectRequest(entries))
			require.NoError(t, err)
			assert.Empty(t, got, "a suggestion that changes nothing must not be shown")
		})
	}
}

func TestSuggest_KeepsOnlyTheNewItems(t *testing.T) {
	entries := []lorebook.Entry{{UID: 1, Comment: "Denerim", Key: []string{"Denerim"}, Content: "x"}}
	resp := `{"suggestions":[{"kind":"triggerKeys","entryUid":1,"addKeys":["Denerim","the capital","house"]}]}`

	got, err := suggestWith(t, resp, connectRequest(entries))
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, []string{"the capital"}, got[0].AddKeys,
		"the existing key and the generic one must both be filtered out")
}

func TestSuggest_BatchesByTokenBudget(t *testing.T) {
	// A small context forces several batches; every entry must still be seen.
	entries := make([]lorebook.Entry, 12)
	for i := range entries {
		entries[i] = lorebook.Entry{
			UID: i + 1, Comment: fmt.Sprintf("Entry %d", i+1),
			Key: []string{fmt.Sprintf("Key%d", i+1)}, Content: strings.Repeat("lore text ", 220),
		}
	}

	req := connectRequest(entries)
	req.Endpoint.ContextSize = 4096

	c := &scriptedCompleter{responses: []string{`{"suggestions":[]}`}}
	_, err := NewConnector(c).Suggest(context.Background(), req)
	require.NoError(t, err)

	assert.Greater(t, len(c.prompts), 1, "a large lorebook should split into batches")
	for i := 1; i <= len(entries); i++ {
		assert.True(t, mentionsEntry(c.prompts, fmt.Sprintf("uid %d ·", i)),
			"entry %d never appeared in a batch", i)
	}
}

func mentionsEntry(prompts []string, needle string) bool {
	for _, p := range prompts {
		if strings.Contains(p, needle) {
			return true
		}
	}
	return false
}

func TestSuggest_EveryBatchCarriesRosterAndFullIndex(t *testing.T) {
	// The index is what lets a batch link to an entry whose text it cannot see.
	entries := make([]lorebook.Entry, 10)
	for i := range entries {
		entries[i] = lorebook.Entry{
			UID: i + 1, Comment: fmt.Sprintf("Entry %d", i+1),
			Key: []string{fmt.Sprintf("Key%d", i+1)}, Content: strings.Repeat("lore ", 500),
		}
	}
	req := connectRequest(entries)
	req.Endpoint.ContextSize = 4096

	c := &scriptedCompleter{responses: []string{`{"suggestions":[]}`}}
	_, err := NewConnector(c).Suggest(context.Background(), req)
	require.NoError(t, err)
	require.Greater(t, len(c.prompts), 1)

	for i, p := range c.prompts {
		assert.Contains(t, p, "1 · Alistair", "batch %d lost the character roster", i)
		assert.Contains(t, p, "10 · Entry 10 · Key10", "batch %d lost the full entry index", i)
		assert.NotContains(t, p, "{{", "batch %d has an unsubstituted placeholder", i)
	}
}

func TestSuggest_DeduplicatesAcrossBatches(t *testing.T) {
	entries := make([]lorebook.Entry, 8)
	for i := range entries {
		entries[i] = lorebook.Entry{
			UID: i + 1, Comment: fmt.Sprintf("Entry %d", i+1),
			Key: []string{fmt.Sprintf("Key%d", i+1)}, Content: strings.Repeat("lore ", 500),
		}
	}
	req := connectRequest(entries)
	req.Endpoint.ContextSize = 4096

	// Every batch proposes the same connection.
	same := `{"suggestions":[{"kind":"triggerKeys","entryUid":1,"addKeys":["Denerim"],"rationale":"x"}]}`
	c := &scriptedCompleter{responses: []string{same}}

	got, err := NewConnector(c).Suggest(context.Background(), req)
	require.NoError(t, err)
	require.Greater(t, len(c.prompts), 1, "test needs multiple batches to be meaningful")
	assert.Len(t, got, 1, "the same proposal from several batches is one suggestion")
}

func TestSuggest_ErrorsWhenTheIndexAloneOverflowsTheContext(t *testing.T) {
	entries := make([]lorebook.Entry, 200)
	for i := range entries {
		entries[i] = lorebook.Entry{
			UID: i + 1, Comment: strings.Repeat("long entry title ", 20),
			Key: []string{strings.Repeat("key ", 20)}, Content: "x",
		}
	}
	req := connectRequest(entries)
	req.Endpoint.ContextSize = 512

	_, err := NewConnector(&scriptedCompleter{responses: []string{`{"suggestions":[]}`}}).
		Suggest(context.Background(), req)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "too large for this endpoint")
	assert.Contains(t, err.Error(), "raise the context size")
}

func TestSuggest_PartialBatchFailureKeepsWhatSucceeded(t *testing.T) {
	entries := make([]lorebook.Entry, 8)
	for i := range entries {
		entries[i] = lorebook.Entry{
			UID: i + 1, Comment: fmt.Sprintf("Entry %d", i+1),
			Key: []string{fmt.Sprintf("Key%d", i+1)}, Content: strings.Repeat("lore ", 500),
		}
	}
	req := connectRequest(entries)
	req.Endpoint.ContextSize = 4096

	// First batch is unparseable, later ones are fine.
	c := &scriptedCompleter{responses: []string{
		"total nonsense",
		`{"suggestions":[{"kind":"triggerKeys","entryUid":1,"addKeys":["the capital"],"rationale":"x"}]}`,
	}}

	got, err := NewConnector(c).Suggest(context.Background(), req)
	require.NoError(t, err, "one bad batch must not discard the others")
	assert.Len(t, got, 1)
}

func TestSuggest_ErrorsWhenEveryBatchFails(t *testing.T) {
	c := &scriptedCompleter{err: errors.New("connection refused")}
	_, err := NewConnector(c).Suggest(context.Background(), connectRequest(testEntries()))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "connection refused")
}

func TestSuggest_MalformedResponseErrorsWithContext(t *testing.T) {
	_, err := suggestWith(t, "not json", connectRequest(testEntries()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse connection response")
}

func TestSuggest_ToleratesFencedJSON(t *testing.T) {
	resp := "```json\n" + `{"suggestions":[{"kind":"triggerKeys","entryUid":1,"addKeys":["the capital"],"rationale":"x"}]}` + "\n```"
	got, err := suggestWith(t, resp, connectRequest(testEntries()))

	require.NoError(t, err)
	assert.Len(t, got, 1)
}

func TestSuggest_EmptySuggestionListIsNotAnError(t *testing.T) {
	got, err := suggestWith(t, `{"suggestions":[]}`, connectRequest(testEntries()))
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestSuggest_MissingTemplateIsAnError(t *testing.T) {
	req := connectRequest(testEntries())
	req.Templates = prompts.TemplateSet{
		SystemPrompt: "x",
		FieldPrompts: map[string]string{},
		LorePrompts:  map[string]string{prompts.LoreConnect: "  "},
	}

	_, err := suggestWith(t, `{"suggestions":[]}`, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no template")
}

func TestNewConnector_NilCompleterFallsBackToDefault(t *testing.T) {
	assert.NotNil(t, NewConnector(nil).completerOrDefault())
}

func TestContextBudget(t *testing.T) {
	assert.Equal(t, 8192-2048, contextBudget(llm.LLMEndpoint{ContextSize: 8192}))
	assert.Equal(t, defaultContextTokens-defaultContextTokens/4, contextBudget(llm.LLMEndpoint{}),
		"an endpoint that does not declare a context size gets the default")
	assert.Equal(t, defaultContextTokens-defaultContextTokens/4, contextBudget(llm.LLMEndpoint{ContextSize: -1}))
}

func TestBatchEntries(t *testing.T) {
	t.Run("everything in one batch when it fits", func(t *testing.T) {
		got := batchEntries(testEntries(), 100_000)
		require.Len(t, got, 1)
		assert.Len(t, got[0], 2)
	})

	t.Run("an oversized entry is sent alone rather than dropped", func(t *testing.T) {
		entries := []lorebook.Entry{
			{UID: 1, Comment: "Huge", Content: strings.Repeat("word ", 5000)},
			{UID: 2, Comment: "Small", Content: "x"},
		}
		got := batchEntries(entries, 10)

		var seen []int
		for _, batch := range got {
			for _, e := range batch {
				seen = append(seen, e.UID)
			}
		}
		assert.ElementsMatch(t, []int{1, 2}, seen, "no entry may be silently excluded")
	})

	t.Run("empty input", func(t *testing.T) {
		assert.Empty(t, batchEntries(nil, 100))
	})
}

func TestMissingItems(t *testing.T) {
	assert.Equal(t, []string{"c"}, missingItems([]string{"A", "b", "c"}, []string{"a", "B"}))
	assert.Empty(t, missingItems([]string{"a"}, []string{"A"}))
	assert.Equal(t, []string{"a"}, missingItems([]string{"a", "A", " a "}, nil), "duplicates collapse")
	assert.Empty(t, missingItems([]string{"  "}, nil))
}

func TestUsableKeys(t *testing.T) {
	assert.Equal(t, []string{"Denerim", "the Queen"}, usableKeys([]string{"Denerim", " ", "house", "the Queen", "sword"}))
}

func TestDedupeSuggestions(t *testing.T) {
	assert.Nil(t, dedupeSuggestions(nil))

	in := []Suggestion{
		{Kind: KindTriggerKeys, EntryUID: 1},
		{Kind: KindTriggerKeys, EntryUID: 1},
		{Kind: KindTriggerKeys, EntryUID: 2},
		{Kind: KindEntryCharacter, EntryUID: 1},
	}
	assert.Len(t, dedupeSuggestions(in), 3)
}
