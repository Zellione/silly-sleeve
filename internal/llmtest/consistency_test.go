package llmtest

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func scenarioResult(runs ...RunResult) ScenarioResult {
	return ScenarioResult{Scenario: "s", Label: "scenario", Runs: runs}
}

func TestConsistency_SingleRunYieldsNoFindings(t *testing.T) {
	sr := scenarioResult(RunResult{Run: 1, Summary: map[string]any{"candidates": 3}})

	assert.Empty(t, analyzeConsistency(sr))
}

func TestConsistency_FlagsPartialFailures(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Err: "dial tcp: connection refused"},
		RunResult{Run: 2, Summary: map[string]any{"candidates": 3}},
		RunResult{Run: 3, Summary: map[string]any{"candidates": 3}},
	)

	findings := analyzeConsistency(sr)

	require.NotEmpty(t, findings)
	assert.Equal(t, "consistency", findings[0].Kind)
	assert.Equal(t, 0, findings[0].Run, "cross-run findings carry run 0")
	assert.Contains(t, findings[0].Msg, "1/3")
}

func TestConsistency_AllRunsFailedIsNotFlaky(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Err: "boom"},
		RunResult{Run: 2, Err: "boom"},
	)

	assert.Empty(t, analyzeConsistency(sr), "consistent failure is documented per run, not as flakiness")
}

func TestConsistency_FlagsPartialFormatProblems(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{}},
		RunResult{Run: 2, Summary: map[string]any{}},
		RunResult{Run: 3, Summary: map[string]any{}},
	)
	sr.Findings = []Finding{{Scenario: "s", Run: 2, Kind: "format", Msg: "invalid JSON forced a retry"}}

	findings := analyzeConsistency(sr)

	require.NotEmpty(t, findings)
	assert.Contains(t, findings[0].Msg, "format problems in 1/3 runs")
}

func TestConsistency_FlagsCountVariance(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"candidates": 2}},
		RunResult{Run: 2, Summary: map[string]any{"candidates": 5}},
	)

	findings := analyzeConsistency(sr)

	require.Len(t, findings, 1)
	assert.Contains(t, findings[0].Msg, "candidates")
	assert.Contains(t, findings[0].Msg, "2")
	assert.Contains(t, findings[0].Msg, "5")
}

func TestConsistency_StableCountsYieldNoFindings(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"candidates": 3, "connectionSuggestions": 1}},
		RunResult{Run: 2, Summary: map[string]any{"candidates": 3, "connectionSuggestions": 1}},
	)

	assert.Empty(t, analyzeConsistency(sr))
}

func TestConsistency_IgnoresLatencyAndBooleans(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"ok": true, "latencyMs": int64(5)}},
		RunResult{Run: 2, Summary: map[string]any{"ok": true, "latencyMs": int64(900)}},
	)

	assert.Empty(t, analyzeConsistency(sr))
}

func TestConsistency_ToleratesNaturalCharSpread(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"chars": 100}},
		RunResult{Run: 2, Summary: map[string]any{"chars": 180}},
	)

	assert.Empty(t, analyzeConsistency(sr), "text length always varies; moderate spread is not a finding")
}

func TestConsistency_FlagsExtremeCharSpread(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"chars": 40}},
		RunResult{Run: 2, Summary: map[string]any{"chars": 400}},
	)

	findings := analyzeConsistency(sr)

	require.Len(t, findings, 1)
	assert.Contains(t, findings[0].Msg, "chars")
}

func TestConsistency_FlagsFieldPresenceVariance(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"fieldChars": map[string]int{"personality": 120, "name": 10}}},
		RunResult{Run: 2, Summary: map[string]any{"fieldChars": map[string]int{"personality": 0, "name": 12}}},
	)

	findings := analyzeConsistency(sr)

	require.Len(t, findings, 1)
	assert.Contains(t, findings[0].Msg, "personality")
	assert.Contains(t, findings[0].Msg, "1/2")
}

func TestConsistency_FlagsUnstableExtractedKeys(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"keys": []string{"hollow mist", "emberfall"}}},
		RunResult{Run: 2, Summary: map[string]any{"keys": []string{"hollow mist", "lanterns"}}},
	)

	findings := analyzeConsistency(sr)

	require.Len(t, findings, 1)
	assert.Contains(t, findings[0].Msg, "1 of 3")
}

func TestConsistency_StableKeysYieldNoFindings(t *testing.T) {
	sr := scenarioResult(
		RunResult{Run: 1, Summary: map[string]any{"keys": []string{"a", "b"}}},
		RunResult{Run: 2, Summary: map[string]any{"keys": []string{"a", "b"}}},
	)

	assert.Empty(t, analyzeConsistency(sr))
}

func TestExecute_AppendsConsistencyFindings(t *testing.T) {
	replies := []string{
		`{"entries":[{"category":"lore","comment":"A","key":["a"],"content":"x","order":55}]}`,
		`{"entries":[{"category":"lore","comment":"A","key":["a"],"content":"x","order":55},` +
			`{"category":"lore","comment":"B","key":["b"],"content":"y","order":55}]}`,
	}
	_, ep := stubLLM(t, func(call int, _ string) string { return replies[call%len(replies)] })
	cfg := Config{Runs: 2, Endpoint: ep}

	results := Execute(context.Background(), cfg, []Scenario{findScenario(t, "lore-extract-split")})

	require.Len(t, results, 1)
	var consistency []Finding
	for _, f := range results[0].Findings {
		if f.Kind == "consistency" {
			consistency = append(consistency, f)
		}
	}
	require.NotEmpty(t, consistency)
	joined := strings.Join(findingMessages(consistency), "; ")
	assert.Contains(t, joined, "candidates")
}
