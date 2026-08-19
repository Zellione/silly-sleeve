// Package llmtest is a manually-run harness that exercises every real LLM
// interaction in the app against a live endpoint and documents format and
// consistency findings. It reuses the production call paths — the same
// prompts, parsing and normalisation the app ships with — by injecting a
// recording completer, so what it measures is what users actually get.
package llmtest

import (
	"context"
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/llm"
)

// Config carries everything one harness invocation needs.
type Config struct {
	Endpoint llm.LLMEndpoint
	// Runs is how often each scenario repeats; values below 1 mean 1.
	Runs int
	// Only filters scenarios by ID; empty means all.
	Only []string
	// OutDir is where reports are written.
	OutDir string
	// Completer is the base completer scenarios talk through; nil means the
	// production HTTP completer.
	Completer llm.Completer
}

func (c Config) completerOrDefault() llm.Completer {
	if c.Completer != nil {
		return c.Completer
	}
	return llm.DefaultCompleter
}

func (c Config) runsOrDefault() int {
	if c.Runs < 1 {
		return 1
	}
	return c.Runs
}

// Exchange is one recorded LLM round trip.
type Exchange struct {
	System     string `json:"system"`
	User       string `json:"user"`
	Response   string `json:"response"`
	Err        string `json:"error,omitempty"`
	DurationMs int64  `json:"durationMs"`
}

// Finding is one documented problem, attributed to a scenario and run.
type Finding struct {
	Scenario string `json:"scenario"`
	// Run is the 1-based run index; 0 marks a cross-run (consistency) finding.
	Run  int    `json:"run,omitempty"`
	Kind string `json:"kind"` // "transport", "format" or "consistency"
	Msg  string `json:"msg"`
}

// RunResult is one execution of a scenario.
type RunResult struct {
	Run       int            `json:"run"`
	Exchanges []Exchange     `json:"exchanges"`
	Summary   map[string]any `json:"summary,omitempty"`
	Err       string         `json:"error,omitempty"`
}

// ScenarioResult aggregates all runs of one scenario.
type ScenarioResult struct {
	Scenario string      `json:"scenario"`
	Label    string      `json:"label"`
	Runs     []RunResult `json:"runs"`
	Findings []Finding   `json:"findings"`
}

// Scenario is one real LLM interaction the harness can exercise. Run executes
// a single interaction against cfg.Endpoint through the given completer and
// returns a scenario-specific summary of the parsed output.
type Scenario struct {
	ID    string
	Label string
	Run   func(ctx context.Context, cfg Config, c llm.Completer) (map[string]any, error)
	// ExpectJSON marks scenarios whose raw responses must be bare JSON.
	ExpectJSON bool
	// Check inspects a successful run's summary and returns format problems.
	Check func(summary map[string]any) []string
}

// FieldText renders one character field as text, for presence checks and
// run-to-run comparison.
func FieldText(ch compose.Character, id string) string {
	switch id {
	case "name":
		return ch.Name
	case "epithet":
		return ch.Epithet
	case "tags":
		return strings.Join(ch.Tags, ", ")
	case "appearance":
		return ch.Appearance
	case "personality":
		return ch.Personality
	case "backstory":
		return ch.Backstory
	case "abilities":
		return ch.Abilities
	case "relationships":
		return ch.Relationships
	case "quotes":
		return strings.Join(ch.Quotes, "\n")
	case "altGreetings":
		return strings.Join(ch.AltGreetings, "\n")
	case "stats":
		parts := make([]string, 0, len(ch.Stats))
		for _, kv := range ch.Stats {
			if strings.TrimSpace(kv.Key) == "" && strings.TrimSpace(kv.Value) == "" {
				continue
			}
			parts = append(parts, kv.Key+": "+kv.Value)
		}
		return strings.Join(parts, "\n")
	default:
		return ""
	}
}
