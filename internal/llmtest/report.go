package llmtest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// RunMeta describes one harness invocation for the report header.
type RunMeta struct {
	EndpointURL string    `json:"endpointUrl"`
	Model       string    `json:"model"`
	Runs        int       `json:"runs"`
	Started     time.Time `json:"started"`
}

var unsafeNameChars = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

// WriteReport writes report.md (human-readable findings, worst offenders
// first) and runs.jsonl (raw request/response pairs) into a new timestamped
// folder under outDir, and returns that folder's path.
func WriteReport(outDir string, meta RunMeta, results []ScenarioResult) (string, error) {
	model := unsafeNameChars.ReplaceAllString(meta.Model, "-")
	if model == "" {
		model = "unknown-model"
	}
	dir := filepath.Join(outDir, meta.Started.Format("2006-01-02-150405")+"-"+model)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create report folder: %w", err)
	}

	if err := os.WriteFile(filepath.Join(dir, "report.md"), []byte(renderMarkdown(meta, results)), 0o644); err != nil {
		return "", fmt.Errorf("write report.md: %w", err)
	}
	jsonl, err := renderJSONL(meta, results)
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(dir, "runs.jsonl"), jsonl, 0o644); err != nil {
		return "", fmt.Errorf("write runs.jsonl: %w", err)
	}
	return dir, nil
}

func renderMarkdown(meta RunMeta, results []ScenarioResult) string {
	total := 0
	for _, r := range results {
		total += len(r.Findings)
	}

	var b strings.Builder
	b.WriteString("# LLM interaction test report\n\n")
	fmt.Fprintf(&b, "- Endpoint: %s (model `%s`)\n", meta.EndpointURL, meta.Model)
	fmt.Fprintf(&b, "- Date: %s\n", meta.Started.Format("2006-01-02 15:04:05 MST"))
	fmt.Fprintf(&b, "- Runs per scenario: %d\n", meta.Runs)
	fmt.Fprintf(&b, "- Scenarios: %d, findings: %d\n", len(results), total)

	ordered := make([]ScenarioResult, len(results))
	copy(ordered, results)
	sort.SliceStable(ordered, func(i, j int) bool {
		return len(ordered[i].Findings) > len(ordered[j].Findings)
	})

	b.WriteString("\n## Findings\n")
	any := false
	for _, r := range ordered {
		if len(r.Findings) == 0 {
			continue
		}
		any = true
		fmt.Fprintf(&b, "\n### %s (`%s`) — %d finding(s)\n\n", r.Label, r.Scenario, len(r.Findings))
		for _, f := range r.Findings {
			if f.Run > 0 {
				fmt.Fprintf(&b, "- [%s] run %d: %s\n", f.Kind, f.Run, f.Msg)
			} else {
				fmt.Fprintf(&b, "- [%s] %s\n", f.Kind, f.Msg)
			}
		}
	}
	if !any {
		b.WriteString("\nNo findings — every scenario ran clean.\n")
	}

	b.WriteString("\n## Clean scenarios\n\n")
	clean := 0
	for _, r := range ordered {
		if len(r.Findings) == 0 {
			fmt.Fprintf(&b, "- %s (`%s`)\n", r.Label, r.Scenario)
			clean++
		}
	}
	if clean == 0 {
		b.WriteString("(none)\n")
	}
	return b.String()
}

func renderJSONL(meta RunMeta, results []ScenarioResult) ([]byte, error) {
	var b strings.Builder
	writeLine := func(v any) error {
		line, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("encode jsonl line: %w", err)
		}
		b.Write(line)
		b.WriteByte('\n')
		return nil
	}

	if err := writeLine(map[string]any{"type": "meta", "meta": meta}); err != nil {
		return nil, err
	}
	for _, r := range results {
		for _, run := range r.Runs {
			if err := writeLine(map[string]any{
				"type":      "run",
				"scenario":  r.Scenario,
				"run":       run.Run,
				"exchanges": run.Exchanges,
				"summary":   run.Summary,
				"error":     run.Err,
			}); err != nil {
				return nil, err
			}
		}
		if len(r.Findings) > 0 {
			if err := writeLine(map[string]any{
				"type":     "findings",
				"scenario": r.Scenario,
				"findings": r.Findings,
			}); err != nil {
				return nil, err
			}
		}
	}
	return []byte(b.String()), nil
}
