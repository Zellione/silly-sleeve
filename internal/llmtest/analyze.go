package llmtest

import (
	"encoding/json"
	"strings"
)

// retryMarker is the fragment llm.CompleteJSON puts into its retry prompt; an
// exchange carrying it means the previous reply failed to parse.
const retryMarker = "could not be parsed as JSON"

// analyzeRun derives format findings from one run: raw-response shape
// problems from the exchanges, plus scenario-specific output problems.
func analyzeRun(s Scenario, run RunResult) []Finding {
	var findings []Finding
	add := func(msg string) {
		findings = append(findings, Finding{Scenario: s.ID, Run: run.Run, Kind: "format", Msg: msg})
	}

	for _, ex := range run.Exchanges {
		for _, msg := range exchangeProblems(s, ex) {
			add(msg)
		}
	}
	if run.Err == "" && s.Check != nil {
		for _, problem := range s.Check(run.Summary) {
			add(problem)
		}
	}
	return findings
}

// exchangeProblems judges one raw exchange against the scenario's expected
// response shape.
func exchangeProblems(s Scenario, ex Exchange) []string {
	if ex.Err != "" {
		return nil // the runner already reported this as a transport finding
	}
	if strings.Contains(ex.User, retryMarker) {
		// The retry itself is the finding; don't double-flag its response.
		return []string{"invalid JSON forced a retry"}
	}
	if strings.TrimSpace(ex.Response) == "" {
		return []string{"empty response"}
	}

	var problems []string
	if s.ExpectJSON && !json.Valid([]byte(strings.TrimSpace(ex.Response))) {
		problems = append(problems, "response is not bare JSON (repair or extraction was needed)")
	}
	lower := strings.ToLower(ex.Response)
	for _, label := range s.ExpectLabels {
		if !strings.Contains(lower, strings.ToLower(label)) {
			problems = append(problems, "response is missing the "+label+" label")
		}
	}
	return problems
}
