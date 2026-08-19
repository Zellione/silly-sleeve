package llmtest

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/llm"
)

func okScenario(id string) Scenario {
	return Scenario{
		ID:    id,
		Label: "Scenario " + id,
		Run: func(ctx context.Context, cfg Config, c llm.Completer) (map[string]any, error) {
			out, err := c.Complete(ctx, cfg.Endpoint, "sys", "user")
			if err != nil {
				return nil, err
			}
			return map[string]any{"reply": out}, nil
		},
	}
}

func staticCompleter(reply string) llm.Completer {
	return llm.CompleterFunc(func(context.Context, llm.LLMEndpoint, string, string) (string, error) {
		return reply, nil
	})
}

func TestExecute_RunsEachScenarioNTimes(t *testing.T) {
	cfg := Config{Runs: 3, Completer: staticCompleter("ok")}

	results := Execute(context.Background(), cfg, []Scenario{okScenario("a"), okScenario("b")})

	require.Len(t, results, 2)
	for _, r := range results {
		assert.Len(t, r.Runs, 3)
		for _, run := range r.Runs {
			assert.Len(t, run.Exchanges, 1)
			assert.Empty(t, run.Err)
			assert.Equal(t, "ok", run.Summary["reply"])
		}
	}
	assert.Equal(t, 1, results[0].Runs[0].Run, "run indices are 1-based")
	assert.Equal(t, 3, results[0].Runs[2].Run)
}

func TestExecute_DefaultsToOneRun(t *testing.T) {
	cfg := Config{Completer: staticCompleter("ok")}

	results := Execute(context.Background(), cfg, []Scenario{okScenario("a")})

	require.Len(t, results, 1)
	assert.Len(t, results[0].Runs, 1)
}

func TestExecute_FiltersScenariosWithOnly(t *testing.T) {
	cfg := Config{Runs: 1, Only: []string{"b"}, Completer: staticCompleter("ok")}

	results := Execute(context.Background(), cfg, []Scenario{okScenario("a"), okScenario("b"), okScenario("c")})

	require.Len(t, results, 1)
	assert.Equal(t, "b", results[0].Scenario)
}

func TestExecute_RecordsTransportFindingOnError(t *testing.T) {
	failing := llm.CompleterFunc(func(context.Context, llm.LLMEndpoint, string, string) (string, error) {
		return "", errors.New("dial tcp: connection refused")
	})
	cfg := Config{Runs: 2, Completer: failing}

	results := Execute(context.Background(), cfg, []Scenario{okScenario("a"), okScenario("b")})

	require.Len(t, results, 2, "a failing scenario must not stop the remaining scenarios")
	first := results[0]
	require.Len(t, first.Runs, 2)
	assert.Contains(t, first.Runs[0].Err, "connection refused")

	require.NotEmpty(t, first.Findings)
	assert.Equal(t, "transport", first.Findings[0].Kind)
	assert.Equal(t, "a", first.Findings[0].Scenario)
	assert.Equal(t, 1, first.Findings[0].Run)
}

func TestExecute_ClassifiesParseFailureAsFormatFinding(t *testing.T) {
	parseFail := Scenario{
		ID:    "p",
		Label: "parse failure",
		Run: func(context.Context, Config, llm.Completer) (map[string]any, error) {
			return nil, errors.New("parse LLM response after retry: invalid character 'x'")
		},
	}
	cfg := Config{Runs: 1, Completer: staticCompleter("ok")}

	results := Execute(context.Background(), cfg, []Scenario{parseFail})

	require.Len(t, results, 1)
	require.NotEmpty(t, results[0].Findings)
	assert.Equal(t, "format", results[0].Findings[0].Kind)
}

func TestExecute_ReportsProgressAfterEachScenario(t *testing.T) {
	var order []string
	cfg := Config{
		Runs:      2,
		Completer: staticCompleter("ok"),
		Progress: func(r ScenarioResult) {
			order = append(order, r.Scenario)
			assert.Len(t, r.Runs, 2, "the callback receives the finished result")
		},
	}

	Execute(context.Background(), cfg, []Scenario{okScenario("a"), okScenario("b")})

	assert.Equal(t, []string{"a", "b"}, order)
}

func TestExecute_StopsAfterCriticalScenarioFails(t *testing.T) {
	failing := llm.CompleterFunc(func(context.Context, llm.LLMEndpoint, string, string) (string, error) {
		return "", errors.New("dial tcp: connection refused")
	})
	critical := okScenario("gate")
	critical.Critical = true
	cfg := Config{Runs: 2, Completer: failing}

	results := Execute(context.Background(), cfg, []Scenario{critical, okScenario("b")})

	require.Len(t, results, 1, "a critical scenario with zero successful runs stops the rest")
	assert.Equal(t, "gate", results[0].Scenario)
}

func TestExecute_ContinuesWhenCriticalScenarioPartiallySucceeds(t *testing.T) {
	calls := 0
	flaky := llm.CompleterFunc(func(context.Context, llm.LLMEndpoint, string, string) (string, error) {
		calls++
		if calls == 1 {
			return "", errors.New("transient")
		}
		return "ok", nil
	})
	critical := okScenario("gate")
	critical.Critical = true
	cfg := Config{Runs: 2, Completer: flaky}

	results := Execute(context.Background(), cfg, []Scenario{critical, okScenario("b")})

	require.Len(t, results, 2, "a flaky critical scenario is documented, not fatal")
}
