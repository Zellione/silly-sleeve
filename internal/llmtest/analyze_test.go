package llmtest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func jsonScenario() Scenario {
	return Scenario{ID: "j", Label: "json scenario", ExpectJSON: true}
}

func TestAnalyzeRun_CleanJSONYieldsNoFindings(t *testing.T) {
	run := RunResult{Run: 1, Exchanges: []Exchange{
		{User: "prompt", Response: `{"name":"Mira"}`},
	}}

	assert.Empty(t, analyzeRun(jsonScenario(), run))
}

func TestAnalyzeRun_FlagsFencedJSONAsNotBare(t *testing.T) {
	run := RunResult{Run: 2, Exchanges: []Exchange{
		{User: "prompt", Response: "```json\n{\"name\":\"Mira\"}\n```"},
	}}

	findings := analyzeRun(jsonScenario(), run)

	require.Len(t, findings, 1)
	assert.Equal(t, "format", findings[0].Kind)
	assert.Equal(t, 2, findings[0].Run)
	assert.Contains(t, findings[0].Msg, "not bare JSON")
}

func TestAnalyzeRun_SkipsJSONCheckWhenNotExpected(t *testing.T) {
	textScenario := Scenario{ID: "t", Label: "text scenario"}
	run := RunResult{Run: 1, Exchanges: []Exchange{
		{User: "prompt", Response: "POSITIVE: a portrait\nNEGATIVE: blurry"},
	}}

	assert.Empty(t, analyzeRun(textScenario, run))
}

func TestAnalyzeRun_FlagsRetryExchange(t *testing.T) {
	run := RunResult{Run: 1, Exchanges: []Exchange{
		{User: "prompt", Response: "not json at all {{{"},
		{User: "prompt\n\nYour previous reply could not be parsed as JSON.\n...", Response: `{"ok":1}`},
	}}

	findings := analyzeRun(jsonScenario(), run)

	msgs := findingMessages(findings)
	assert.Contains(t, msgs, "invalid JSON forced a retry")
}

func TestAnalyzeRun_FlagsEmptyResponse(t *testing.T) {
	run := RunResult{Run: 1, Exchanges: []Exchange{{User: "prompt", Response: ""}}}

	findings := analyzeRun(jsonScenario(), run)

	require.NotEmpty(t, findings)
	assert.Contains(t, findings[0].Msg, "empty response")
}

func TestAnalyzeRun_IgnoresTransportFailedExchanges(t *testing.T) {
	run := RunResult{Run: 1, Exchanges: []Exchange{
		{User: "prompt", Response: "", Err: "connection refused"},
	}}

	assert.Empty(t, analyzeRun(jsonScenario(), run), "transport errors are reported by the runner, not double-counted here")
}

func TestAnalyzeRun_RunsScenarioCheckOnSummary(t *testing.T) {
	s := Scenario{
		ID: "c", Label: "checked",
		Check: func(summary map[string]any) []string {
			if summary["missing"] == true {
				return []string{"required field personality is empty"}
			}
			return nil
		},
	}
	bad := RunResult{Run: 1, Summary: map[string]any{"missing": true}}
	good := RunResult{Run: 2, Summary: map[string]any{"missing": false}}

	badFindings := analyzeRun(s, bad)
	require.Len(t, badFindings, 1)
	assert.Equal(t, "format", badFindings[0].Kind)
	assert.Contains(t, badFindings[0].Msg, "personality")

	assert.Empty(t, analyzeRun(s, good))
}

func TestAnalyzeRun_SkipsCheckWhenRunErrored(t *testing.T) {
	s := Scenario{
		ID: "c", Label: "checked",
		Check: func(map[string]any) []string { return []string{"should not fire"} },
	}
	run := RunResult{Run: 1, Err: "dial tcp: connection refused"}

	assert.Empty(t, analyzeRun(s, run))
}

func findingMessages(fs []Finding) []string {
	msgs := make([]string, 0, len(fs))
	for _, f := range fs {
		msgs = append(msgs, f.Msg)
	}
	return msgs
}
