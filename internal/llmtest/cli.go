package llmtest

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"slices"
	"strings"
	"time"

	"silly-sleeve/internal/llm"
)

// DefaultEndpointURL is where the harness looks for a local OpenAI-compatible
// server when no -endpoint is given.
const DefaultEndpointURL = "http://localhost:8001"

// RunCLI parses args, runs the harness and writes the report. It returns the
// process exit code: findings never fail the run — they are the product — so
// only unusable flags or an unwritable report return 1.
func RunCLI(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("llmtest", flag.ContinueOnError)
	fs.SetOutput(stderr)
	endpoint := fs.String("endpoint", DefaultEndpointURL, "OpenAI-compatible endpoint URL to test against")
	model := fs.String("model", "", "model name sent with every request")
	apiKey := fs.String("api-key", "", "bearer token, if the endpoint needs one")
	runs := fs.Int("runs", 3, "how often each scenario repeats for consistency analysis")
	only := fs.String("only", "", "comma-separated scenario IDs to run (default: all)")
	out := fs.String("out", "docs/llm-reports", "directory that receives the timestamped report folder")
	timeout := fs.Int("timeout", 0, "per-request timeout in seconds (0 = built-in default)")
	forceJSON := fs.Bool("force-json", false, "ask the backend for JSON mode via response_format")
	list := fs.Bool("list", false, "list scenario IDs and exit")

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		return 1
	}

	scenarios := Scenarios()
	if *list {
		for _, s := range scenarios {
			fmt.Fprintf(stdout, "%-22s %s\n", s.ID, s.Label)
		}
		return 0
	}
	if *runs < 1 {
		fmt.Fprintln(stderr, "llmtest: -runs must be at least 1")
		return 1
	}
	onlyIDs, err := parseOnly(*only, scenarios)
	if err != nil {
		fmt.Fprintf(stderr, "llmtest: %v\n", err)
		return 1
	}

	cfg := Config{
		Endpoint: llm.LLMEndpoint{
			URL:            strings.TrimRight(*endpoint, "/"),
			Model:          *model,
			TimeoutSeconds: *timeout,
			ForceJSON:      *forceJSON,
		},
		Runs:   *runs,
		Only:   onlyIDs,
		OutDir: *out,
	}
	if *apiKey != "" {
		cfg.Endpoint.Key = apiKey
	}

	fmt.Fprintf(stdout, "Testing %s (model %q), %d run(s) per scenario\n", cfg.Endpoint.URL, *model, *runs)
	results := Execute(context.Background(), cfg, scenarios)

	total := 0
	for _, r := range results {
		total += len(r.Findings)
		fmt.Fprintf(stdout, "%-22s %d finding(s) in %d run(s)\n", r.Scenario, len(r.Findings), len(r.Runs))
	}

	meta := RunMeta{EndpointURL: cfg.Endpoint.URL, Model: *model, Runs: *runs, Started: time.Now()}
	dir, err := WriteReport(cfg.OutDir, meta, results)
	if err != nil {
		fmt.Fprintf(stderr, "llmtest: %v\n", err)
		return 1
	}
	fmt.Fprintf(stdout, "\n%d finding(s) total — report written to %s\n", total, dir)
	return 0
}

// parseOnly validates a comma-separated scenario filter against the registry.
func parseOnly(only string, scenarios []Scenario) ([]string, error) {
	if strings.TrimSpace(only) == "" {
		return nil, nil
	}
	valid := make([]string, 0, len(scenarios))
	for _, s := range scenarios {
		valid = append(valid, s.ID)
	}
	var ids []string
	for _, id := range strings.Split(only, ",") {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if !slices.Contains(valid, id) {
			return nil, fmt.Errorf("unknown scenario %q in -only; valid scenarios: %s",
				id, strings.Join(valid, ", "))
		}
		ids = append(ids, id)
	}
	return ids, nil
}
