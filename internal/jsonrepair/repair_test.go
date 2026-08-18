package jsonrepair

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCleanStripsJSONFence(t *testing.T) {
	in := "```json\n{\"a\": 1}\n```"
	assert.Equal(t, `{"a": 1}`, Clean(in))
}

func TestCleanStripsBareFence(t *testing.T) {
	in := "```\n{\"a\": 1}\n```"
	assert.Equal(t, `{"a": 1}`, Clean(in))
}

func TestCleanStripsSurroundingProse(t *testing.T) {
	in := "Here are the entries:\n{\"entries\": []}\nHope that helps!"
	assert.Equal(t, `{"entries": []}`, Clean(in))
}

func TestCleanKeepsBareArrayWhole(t *testing.T) {
	// The array must not be cut down to its first element's braces.
	in := "Sure!\n[{\"a\": 1}, {\"b\": 2}]"
	assert.Equal(t, `[{"a": 1}, {"b": 2}]`, Clean(in))
}

func TestCleanNoJSONReturnsTrimmed(t *testing.T) {
	assert.Equal(t, "just prose", Clean("  just prose\n"))
}

func TestRepairValidJSONUnchanged(t *testing.T) {
	valid := []string{
		`{"a": 1, "b": [true, false, null]}`,
		`[{"content": "line with 'apostrophes' and \"escaped quotes\""}]`,
		`{"entries": [{"key": ["a", "b"], "order": 100, "constant": true}]}`,
		`{"s": "text with \\n escaped newline and slash / inside"}`,
		`{"url": "https://example.com/page"}`,
	}
	for _, v := range valid {
		assert.Equal(t, v, Repair(v), "valid JSON must pass through unchanged: %s", v)
	}
}

func TestRepairEscapesLiteralControlCharsInStrings(t *testing.T) {
	in := "{\"content\": \"line one\nline two\ttabbed\"}"
	out := Repair(in)
	var m map[string]string
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, "line one\nline two\ttabbed", m["content"])
}

func TestRepairRemovesTrailingCommas(t *testing.T) {
	in := `{"a": [1, 2, ], "b": {"c": 3, }, }`
	out := Repair(in)
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, 3.0, m["b"].(map[string]any)["c"])
}

func TestRepairConvertsSingleQuotedStrings(t *testing.T) {
	in := `{'name': 'Eldoria', 'keys': ['a', 'b']}`
	out := Repair(in)
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, "Eldoria", m["name"])
}

func TestRepairSingleQuotedStringWithInnerDoubleQuote(t *testing.T) {
	in := `{'quote': 'He said "hi" to her'}`
	out := Repair(in)
	var m map[string]string
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, `He said "hi" to her`, m["quote"])
}

func TestRepairLeavesApostrophesInDoubleQuotedStrings(t *testing.T) {
	in := `{"content": "it's the city's crest"}`
	assert.Equal(t, in, Repair(in))
}

func TestRepairConvertsPythonLiterals(t *testing.T) {
	in := `{"constant": True, "selective": False, "extra": None}`
	out := Repair(in)
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, true, m["constant"])
	assert.Equal(t, false, m["selective"])
	assert.Nil(t, m["extra"])
}

func TestRepairKeepsPythonWordsInsideStrings(t *testing.T) {
	in := `{"content": "True North and None the wiser"}`
	assert.Equal(t, in, Repair(in))
}

func TestRepairStripsLineComments(t *testing.T) {
	in := "{\n  \"a\": 1, // the first field\n  \"b\": 2\n}"
	out := Repair(in)
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, 2.0, m["b"])
}

func TestRepairStripsBlockComments(t *testing.T) {
	in := `{"a": /* note */ 1}`
	out := Repair(in)
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, 1.0, m["a"])
}

func TestRepairKeepsSlashesInsideStrings(t *testing.T) {
	in := `{"url": "https://example.com//path"}`
	assert.Equal(t, in, Repair(in))
}

func TestRepairClosesTruncatedOutput(t *testing.T) {
	// Cut off mid-string, as a max-tokens truncation would.
	in := `{"entries": [{"comment": "Eldoria", "content": "The silver ci`
	out := Repair(in)
	var resp struct {
		Entries []struct {
			Comment string `json:"comment"`
		} `json:"entries"`
	}
	require.NoError(t, json.Unmarshal([]byte(out), &resp))
	require.Len(t, resp.Entries, 1)
	assert.Equal(t, "Eldoria", resp.Entries[0].Comment)
}

func TestRepairClosesTruncationEndingInBackslash(t *testing.T) {
	in := `{"content": "cut mid-escape \`
	out := Repair(in)
	var m map[string]string
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, "cut mid-escape ", m["content"])
}

func TestRepairDropsDanglingCommaOnTruncation(t *testing.T) {
	in := `{"a": 1,`
	out := Repair(in)
	var m map[string]any
	require.NoError(t, json.Unmarshal([]byte(out), &m))
	assert.Equal(t, 1.0, m["a"])
}

func TestRepairCombinedDefects(t *testing.T) {
	in := "{'entries': [ // extracted\n{'comment': 'A', 'content': \"line one\nline two\", 'constant': True,},\n]}"
	out := Repair(in)
	var resp struct {
		Entries []struct {
			Comment  string `json:"comment"`
			Content  string `json:"content"`
			Constant bool   `json:"constant"`
		} `json:"entries"`
	}
	require.NoError(t, json.Unmarshal([]byte(out), &resp))
	require.Len(t, resp.Entries, 1)
	assert.Equal(t, "A", resp.Entries[0].Comment)
	assert.Equal(t, "line one\nline two", resp.Entries[0].Content)
	assert.True(t, resp.Entries[0].Constant)
}
