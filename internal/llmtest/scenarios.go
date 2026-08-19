package llmtest

import (
	"context"
	"errors"
	"fmt"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/loreextract"
	"silly-sleeve/internal/prompts"
)

// Scenarios returns every real LLM interaction the harness can exercise, in
// report order.
func Scenarios() []Scenario {
	return []Scenario{
		endpointScenario(),
		bulkGenerateScenario(),
		fieldRerollScenario(),
		imagePromptScenario("natural"),
		imagePromptScenario("danbooru"),
		loreExtractScenario(loreextract.ModeSplit),
		loreExtractScenario(loreextract.ModeSummary),
		loreConnectScenario(),
		loreOptimizeScenario(),
	}
}

// endpointScenario probes connectivity the same way the settings Test button
// does, including the JSON-mode probe when ForceJSON is on.
func endpointScenario() Scenario {
	return Scenario{
		ID:    "endpoint-test",
		Label: "Endpoint connectivity test",
		Run: func(_ context.Context, cfg Config, _ llm.Completer) (map[string]any, error) {
			result := llm.TestEndpoint(cfg.Endpoint)
			if !result.Ok {
				return nil, errors.New(result.Error)
			}
			return map[string]any{"ok": true, "latencyMs": result.Latency}, nil
		},
	}
}

// bulkGenerateScenario runs the full character generation from the fixture
// crawl, the highest-traffic format-sensitive call in the app.
func bulkGenerateScenario() Scenario {
	return Scenario{
		ID:         "bulk-generate",
		Label:      "Bulk character generation",
		ExpectJSON: true,
		Run: func(ctx context.Context, cfg Config, c llm.Completer) (map[string]any, error) {
			ch, err := compose.GenerateBulkWith(ctx, c, FixtureCrawl(), cfg.Endpoint, nil, compose.NewCharacter(1))
			if err != nil {
				return nil, err
			}
			return characterSummary(ch), nil
		},
		Check: missingRequiredCheck,
	}
}

// fieldRerollScenario re-rolls a single field with the default per-field
// prompt template, the way the editor's reroll button does.
func fieldRerollScenario() Scenario {
	const fieldID = "personality"
	return Scenario{
		ID:         "field-reroll",
		Label:      "Per-field reroll (" + fieldID + ")",
		ExpectJSON: true,
		Run: func(ctx context.Context, cfg Config, c llm.Completer) (map[string]any, error) {
			req := compose.FieldRequest{
				FieldID:   fieldID,
				Result:    FixtureCrawl(),
				Existing:  FixtureCharacter(),
				Templates: prompts.Defaults(),
			}
			ch, err := compose.GenerateFieldWith(ctx, c, cfg.Endpoint, req)
			if err != nil {
				return nil, err
			}
			return map[string]any{"field": fieldID, "chars": len(FieldText(ch, fieldID))}, nil
		},
		Check: func(summary map[string]any) []string {
			if chars, ok := summary["chars"].(int); ok && chars == 0 {
				return []string{"reroll returned an empty field"}
			}
			return nil
		},
	}
}

// characterSummary reduces a generated character to comparable numbers.
func characterSummary(ch compose.Character) map[string]any {
	fieldChars := make(map[string]int, len(compose.FieldIDs()))
	missing := []string{}
	for _, id := range compose.FieldIDs() {
		text := FieldText(ch, id)
		fieldChars[id] = len(text)
		if compose.FieldRequired(id) && text == "" {
			missing = append(missing, id)
		}
	}
	return map[string]any{"fieldChars": fieldChars, "missingRequired": missing}
}

func missingRequiredCheck(summary map[string]any) []string {
	missing, ok := summary["missingRequired"].([]string)
	if !ok || len(missing) == 0 {
		return nil
	}
	problems := make([]string, 0, len(missing))
	for _, id := range missing {
		problems = append(problems, fmt.Sprintf("required field %s came back empty", id))
	}
	return problems
}
