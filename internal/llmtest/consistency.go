package llmtest

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// analyzeConsistency derives cross-run findings from a scenario's runs: flaky
// failures, partial format problems, and output variance. Cross-run findings
// carry Run 0.
func analyzeConsistency(sr ScenarioResult) []Finding {
	n := len(sr.Runs)
	if n < 2 {
		return nil
	}
	var findings []Finding
	add := func(msg string) {
		findings = append(findings, Finding{Scenario: sr.Scenario, Kind: "consistency", Msg: msg})
	}

	successful := make([]RunResult, 0, n)
	for _, r := range sr.Runs {
		if r.Err == "" {
			successful = append(successful, r)
		}
	}
	if failed := n - len(successful); failed > 0 && failed < n {
		add(fmt.Sprintf("scenario failed in %d/%d runs", failed, n))
	}

	formatRuns := map[int]bool{}
	for _, f := range sr.Findings {
		if f.Kind == "format" && f.Run > 0 {
			formatRuns[f.Run] = true
		}
	}
	if len(formatRuns) > 0 && len(formatRuns) < n {
		add(fmt.Sprintf("format problems in %d/%d runs", len(formatRuns), n))
	}

	if len(successful) >= 2 {
		findings = append(findings, compareSummaries(sr.Scenario, successful)...)
	}
	return findings
}

// compareSummaries flags summary values that differ across successful runs.
// Counts must match exactly; text lengths only flag absence or extreme spread,
// because generated text never has a stable length.
func compareSummaries(scenarioID string, runs []RunResult) []Finding {
	var findings []Finding
	add := func(msg string) {
		findings = append(findings, Finding{Scenario: scenarioID, Kind: "consistency", Msg: msg})
	}

	first := runs[0].Summary
	keys := make([]string, 0, len(first))
	for key := range first {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		if key == "latencyMs" {
			continue
		}
		switch first[key].(type) {
		case int:
			if vals, ok := intValues(runs, key); ok {
				if msg := intVarianceMessage(key, vals); msg != "" {
					add(msg)
				}
			}
		case map[string]int:
			findings = append(findings, fieldPresenceFindings(scenarioID, runs, key)...)
		case []string:
			if msg := keyStabilityMessage(runs, key); msg != "" {
				add(msg)
			}
		}
	}
	return findings
}

// intVarianceMessage applies the count-vs-text-length rules to one int summary
// key; an empty return means the values are acceptably stable.
func intVarianceMessage(key string, vals []int) string {
	lo, hi := minMax(vals)
	if strings.Contains(strings.ToLower(key), "chars") {
		if (lo == 0 && hi > 0) || (lo > 0 && hi > 3*lo) {
			return fmt.Sprintf("%s varied widely across runs: %s", key, joinInts(vals))
		}
		return ""
	}
	if lo != hi {
		return fmt.Sprintf("%s varied across runs: %s", key, joinInts(vals))
	}
	return ""
}

// fieldPresenceFindings flags fields that came back filled in some runs and
// empty in others.
func fieldPresenceFindings(scenarioID string, runs []RunResult, key string) []Finding {
	filled := map[string]int{}
	fields := map[string]bool{}
	for _, r := range runs {
		m, ok := r.Summary[key].(map[string]int)
		if !ok {
			return nil
		}
		for field, chars := range m {
			fields[field] = true
			if chars > 0 {
				filled[field]++
			}
		}
	}
	names := make([]string, 0, len(fields))
	for field := range fields {
		names = append(names, field)
	}
	sort.Strings(names)

	var findings []Finding
	for _, field := range names {
		if count := filled[field]; count > 0 && count < len(runs) {
			findings = append(findings, Finding{
				Scenario: scenarioID,
				Kind:     "consistency",
				Msg:      fmt.Sprintf("field %s was filled in %d/%d runs", field, count, len(runs)),
			})
		}
	}
	return findings
}

// keyStabilityMessage compares string sets across runs; an empty return means
// the sets agree.
func keyStabilityMessage(runs []RunResult, key string) string {
	union := map[string]bool{}
	counts := map[string]int{}
	for _, r := range runs {
		vals, ok := r.Summary[key].([]string)
		if !ok {
			return ""
		}
		seen := map[string]bool{}
		for _, v := range vals {
			union[v] = true
			if !seen[v] {
				seen[v] = true
				counts[v]++
			}
		}
	}
	stable := 0
	for v := range union {
		if counts[v] == len(runs) {
			stable++
		}
	}
	if stable == len(union) {
		return ""
	}
	return fmt.Sprintf("unstable %s: only %d of %d distinct values appeared in every run", key, stable, len(union))
}

func intValues(runs []RunResult, key string) ([]int, bool) {
	vals := make([]int, 0, len(runs))
	for _, r := range runs {
		v, ok := r.Summary[key].(int)
		if !ok {
			return nil, false
		}
		vals = append(vals, v)
	}
	return vals, true
}

func minMax(vals []int) (int, int) {
	lo, hi := vals[0], vals[0]
	for _, v := range vals[1:] {
		if v < lo {
			lo = v
		}
		if v > hi {
			hi = v
		}
	}
	return lo, hi
}

func joinInts(vals []int) string {
	parts := make([]string, len(vals))
	for i, v := range vals {
		parts[i] = strconv.Itoa(v)
	}
	return strings.Join(parts, ", ")
}
