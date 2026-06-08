package comfy

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var placeholderPattern = regexp.MustCompile(`\{\{(\w+)\}\}`)

// BuildPlaceholderValues creates a map of placeholder names to typed values.
func BuildPlaceholderValues(p GenerationParams) map[string]any {
	m := map[string]any{
		"seed":             float64(p.Seed),
		"steps":            float64(p.Steps),
		"cfg":              p.CFG,
		"sampler":          p.Sampler,
		"scheduler":        p.Scheduler,
		"width":            float64(p.Width),
		"height":           float64(p.Height),
		"positive_prompt":  p.PositivePrompt,
		"negative_prompt":  p.NegativePrompt,
		"ckpt_name":        p.Checkpoint,
		"model":            p.Checkpoint,
		"checkpoint":       p.Checkpoint,
	}
	return m
}

// ReplacePlaceholders walks the workflow JSON and substitutes {{placeholder}} in string values
// with the corresponding typed value. Numeric placeholders (seed, steps, cfg, width, height)
// are injected as their native type, not as strings.
func ReplacePlaceholders(template, positions json.RawMessage, values map[string]any) (json.RawMessage, error) {
	var raw any
	if err := json.Unmarshal(template, &raw); err != nil {
		return nil, fmt.Errorf("parse template: %w", err)
	}

	result, err := replaceInValue(raw, values)
	if err != nil {
		return nil, err
	}

	out, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("marshal result: %w", err)
	}
	return json.RawMessage(out), nil
}

func replaceInValue(v any, values map[string]any) (any, error) {
	switch val := v.(type) {
	case map[string]any:
		result := make(map[string]any, len(val))
		for k, vv := range val {
			r, err := replaceInValue(vv, values)
			if err != nil {
				return nil, err
			}
			result[k] = r
		}
		return result, nil
	case []any:
		result := make([]any, len(val))
		for i, vv := range val {
			r, err := replaceInValue(vv, values)
			if err != nil {
				return nil, err
			}
			result[i] = r
		}
		return result, nil
	case string:
		if placeholderPattern.MatchString(val) {
			return replaceStringPlaceholder(val, values)
		}
		return val, nil
	default:
		return val, nil
	}
}

func replaceStringPlaceholder(s string, values map[string]any) (any, error) {
	match := placeholderPattern.FindStringSubmatch(s)
	if len(match) != 2 {
		return s, nil
	}

	name := match[1]
	replacement, ok := values[name]
	if !ok {
		return nil, fmt.Errorf("unknown placeholder {{%s}}", name)
	}

	entire := "{{" + name + "}}"

	if s == entire {
		return replacement, nil
	}

	r, ok := replacement.(string)
	if !ok {
		r = fmt.Sprintf("%v", replacement)
	}
	return strings.Replace(s, entire, r, 1), nil
}

// ExtractPlaceholders scans a template JSON and returns all unique placeholder names.
func ExtractPlaceholders(template json.RawMessage) ([]string, error) {
	seen := make(map[string]bool)
	if err := scanPlaceholders(template, seen); err != nil {
		return nil, err
	}
	result := make([]string, 0, len(seen))
	for name := range seen {
		result = append(result, name)
	}
	return result, nil
}

func scanPlaceholders(raw json.RawMessage, seen map[string]bool) error {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return err
	}
	scanValue(v, seen)
	return nil
}

func scanValue(v any, seen map[string]bool) {
	switch val := v.(type) {
	case map[string]any:
		for _, vv := range val {
			scanValue(vv, seen)
		}
	case []any:
		for _, vv := range val {
			scanValue(vv, seen)
		}
	case string:
		matches := placeholderPattern.FindAllStringSubmatch(val, -1)
		for _, m := range matches {
			if len(m) == 2 {
				seen[m[1]] = true
			}
		}
	}
}
