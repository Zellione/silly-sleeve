package llmtest

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"silly-sleeve/internal/app"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/loreextract"
	"silly-sleeve/internal/prompts"
	"silly-sleeve/internal/settings"
)

// connectionKinds are the suggestion kinds that link things together; every
// other kind is a rule change (the optimize family).
var connectionKinds = map[string]bool{
	loreextract.KindEntryCharacter:     true,
	loreextract.KindTriggerKeys:        true,
	loreextract.KindEntryEntry:         true,
	loreextract.KindCharacterCharacter: true,
}

func imagePromptScenario(style string) Scenario {
	return Scenario{
		ID:           "image-prompt-" + style,
		Label:        "Image prompt generation (" + style + ")",
		ExpectLabels: []string{"POSITIVE:", "NEGATIVE:"},
		Run: func(ctx context.Context, cfg Config, c llm.Completer) (map[string]any, error) {
			gen := app.NewCharacterGenerator(func() context.Context { return ctx }, c)
			positive, negative, err := gen.GenerateImagePrompt(FixtureCharacter(), toSettingsEndpoint(cfg.Endpoint), style)
			if err != nil {
				return nil, err
			}
			return map[string]any{
				"positiveChars": len(positive),
				"negativeChars": len(negative),
			}, nil
		},
	}
}

func loreExtractScenario(mode loreextract.ExtractionMode) Scenario {
	return Scenario{
		ID:         "lore-extract-" + string(mode),
		Label:      "Lore extraction (" + string(mode) + " mode)",
		ExpectJSON: true,
		Run: func(ctx context.Context, cfg Config, c llm.Completer) (map[string]any, error) {
			candidates, err := loreextract.NewExtractor(c).Extract(ctx, loreextract.ExtractRequest{
				Crawl:      FixtureCrawl(),
				Mode:       mode,
				Endpoint:   cfg.Endpoint,
				Characters: FixtureCharacters(),
				Existing:   FixtureEntries(),
				Templates:  prompts.TemplateSet{},
			})
			if err != nil {
				return nil, err
			}
			keys := []string{}
			adjustments := []string{}
			for _, cand := range candidates {
				for _, k := range cand.Entry.Key {
					keys = append(keys, strings.ToLower(k))
				}
				for _, a := range cand.Adjustments {
					// Category-mandated settings (position, recursion) fire for
					// every entry of most categories; only corrections of fields
					// the model actually chose say anything about the model.
					if !lorebook.IsCategoryMandated(a) {
						adjustments = append(adjustments, a)
					}
				}
			}
			sort.Strings(keys)
			return map[string]any{
				"candidates":  len(candidates),
				"keys":        keys,
				"adjustments": adjustments,
			}, nil
		},
		Check: loreExtractCheck,
	}
}

func loreExtractCheck(summary map[string]any) []string {
	var problems []string
	if adj, ok := summary["adjustments"].([]string); ok && len(adj) > 0 {
		problems = append(problems, fmt.Sprintf(
			"normaliser corrected the model output %d time(s) (first: %s)", len(adj), adj[0]))
	}
	if candidates, ok := summary["candidates"].(int); ok && candidates == 0 {
		problems = append(problems, "extraction produced no candidates")
	}
	return problems
}

func loreConnectScenario() Scenario {
	s := suggestScenario("lore-connect", "Lore connection suggestions", FixtureEntries)
	s.Check = func(summary map[string]any) []string {
		if n, ok := summary["connectionSuggestions"].(int); ok && n == 0 {
			return []string{"no connection suggestions for a lorebook with known gaps (a keyless entry)"}
		}
		return nil
	}
	return s
}

func loreOptimizeScenario() Scenario {
	return suggestScenario("lore-optimize", "Lore optimize / rule-change suggestions", FixtureRuleGapEntries)
}

// suggestScenario runs the connection pass over the given entries; connect and
// optimize share the production call and differ in the lorebook they analyse.
func suggestScenario(id, label string, entries func() []lorebook.Entry) Scenario {
	return Scenario{
		ID:         id,
		Label:      label,
		ExpectJSON: true,
		Run: func(ctx context.Context, cfg Config, c llm.Completer) (map[string]any, error) {
			suggestions, err := loreextract.NewConnector(c).Suggest(ctx, loreextract.ConnectRequest{
				Entries:    entries(),
				Characters: FixtureCharacters(),
				Endpoint:   cfg.Endpoint,
				Templates:  prompts.TemplateSet{},
			})
			if err != nil {
				return nil, err
			}
			byKind := map[string]int{}
			connections, ruleChanges := 0, 0
			for _, sg := range suggestions {
				byKind[sg.Kind]++
				if connectionKinds[sg.Kind] {
					connections++
				} else {
					ruleChanges++
				}
			}
			return map[string]any{
				"connectionSuggestions": connections,
				"ruleChangeSuggestions": ruleChanges,
				"byKind":                byKind,
			}, nil
		},
	}
}

// toSettingsEndpoint mirrors app.toLLMEndpoint in the other direction, for the
// generator APIs that take the settings shape.
func toSettingsEndpoint(ep llm.LLMEndpoint) settings.LLMEndpoint {
	return settings.LLMEndpoint{
		ID:             ep.ID,
		Name:           ep.Name,
		URL:            ep.URL,
		Model:          ep.Model,
		Key:            ep.Key,
		ContextSize:    ep.ContextSize,
		Temperature:    ep.Temperature,
		SystemPrompt:   ep.SystemPrompt,
		TimeoutSeconds: ep.TimeoutSeconds,
		ForceJSON:      ep.ForceJSON,
	}
}
