package llmtest

import (
	"context"
	"fmt"
	"slices"
	"strings"
)

// Execute runs each scenario Runs times and aggregates the results. A failing
// scenario never stops the rest: every error becomes a finding instead.
func Execute(ctx context.Context, cfg Config, scenarios []Scenario) []ScenarioResult {
	results := make([]ScenarioResult, 0, len(scenarios))
	for _, s := range scenarios {
		if len(cfg.Only) > 0 && !slices.Contains(cfg.Only, s.ID) {
			continue
		}
		res := executeScenario(ctx, cfg, s)
		if cfg.Progress != nil {
			cfg.Progress(res)
		}
		results = append(results, res)
		if s.Critical && !anyRunSucceeded(res) {
			break
		}
	}
	return results
}

func anyRunSucceeded(res ScenarioResult) bool {
	for _, run := range res.Runs {
		if run.Err == "" {
			return true
		}
	}
	return false
}

func executeScenario(ctx context.Context, cfg Config, s Scenario) ScenarioResult {
	res := ScenarioResult{Scenario: s.ID, Label: s.Label}
	for i := 1; i <= cfg.runsOrDefault(); i++ {
		rec := NewRecorder(cfg.completerOrDefault())
		summary, err := s.Run(ctx, cfg, rec)
		run := RunResult{Run: i, Exchanges: rec.Exchanges, Summary: summary}
		if err != nil {
			run.Err = err.Error()
			res.Findings = append(res.Findings, Finding{
				Scenario: s.ID,
				Run:      i,
				Kind:     classifyError(err),
				Msg:      err.Error(),
			})
		}
		res.Findings = append(res.Findings, analyzeRun(s, run)...)
		res.Runs = append(res.Runs, run)
	}
	res.Findings = append(res.Findings, analyzeConsistency(res)...)
	return res
}

// classifyError separates "the model replied but we could not parse it" from
// "the request itself failed".
func classifyError(err error) string {
	if strings.Contains(fmt.Sprintf("%v", err), "parse") {
		return "format"
	}
	return "transport"
}
