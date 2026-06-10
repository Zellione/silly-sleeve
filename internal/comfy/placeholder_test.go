package comfy

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReplacePlaceholders_NumericValues(t *testing.T) {
	raw := json.RawMessage(`{"nodes":{"1":{"class_type":"KSampler","inputs":{"seed":"{{seed}}","steps":"{{steps}}","cfg":"{{cfg}}"}}}}`)
	values := map[string]any{
		"seed":  float64(42),
		"steps": float64(28),
		"cfg":   7.5,
	}

	result, err := ReplacePlaceholders(raw, nil, values)
	require.NoError(t, err)

	var m map[string]any
	err = json.Unmarshal(result, &m)
	require.NoError(t, err)

	nodes := m["nodes"].(map[string]any)
	node := nodes["1"].(map[string]any)
	inputs := node["inputs"].(map[string]any)

	assert.Equal(t, float64(42), inputs["seed"])
	assert.Equal(t, float64(28), inputs["steps"])
	assert.Equal(t, 7.5, inputs["cfg"])
}

func TestReplacePlaceholders_StringValues(t *testing.T) {
	raw := json.RawMessage(`{"nodes":{"2":{"class_type":"CLIPTextEncode","inputs":{"text":"{{positive_prompt}}"}}}}`)
	values := map[string]any{
		"positive_prompt": "masterpiece, best quality",
	}

	result, err := ReplacePlaceholders(raw, nil, values)
	require.NoError(t, err)

	var m map[string]any
	err = json.Unmarshal(result, &m)
	require.NoError(t, err)

	nodes := m["nodes"].(map[string]any)
	node := nodes["2"].(map[string]any)
	inputs := node["inputs"].(map[string]any)

	assert.Equal(t, "masterpiece, best quality", inputs["text"])
}

func TestReplacePlaceholders_ArrayContainingPlaceholder(t *testing.T) {
	raw := json.RawMessage(`[{"text":"{{seed}}"}]`)
	values := map[string]any{"seed": float64(7)}

	result, err := ReplacePlaceholders(raw, nil, values)
	require.NoError(t, err)

	var arr []any
	err = json.Unmarshal(result, &arr)
	require.NoError(t, err)

	assert.Equal(t, float64(7), arr[0].(map[string]any)["text"])
}

func TestReplacePlaceholders_UnknownPlaceholder(t *testing.T) {
	raw := json.RawMessage(`{"text":"{{unknown}}"}`)
	values := map[string]any{}

	_, err := ReplacePlaceholders(raw, nil, values)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown placeholder")
}

func TestReplacePlaceholders_PartialStringReplace(t *testing.T) {
	raw := json.RawMessage(`{"text":"Hello {{name}} world"}`)
	values := map[string]any{"name": "Bob"}

	result, err := ReplacePlaceholders(raw, nil, values)
	require.NoError(t, err)

	var m map[string]any
	err = json.Unmarshal(result, &m)
	require.NoError(t, err)

	assert.Equal(t, "Hello Bob world", m["text"])
}

func TestReplacePlaceholders_FullStringReplace(t *testing.T) {
	raw := json.RawMessage(`{"text":"{{name}}"}`)
	values := map[string]any{"name": "Alice"}

	result, err := ReplacePlaceholders(raw, nil, values)
	require.NoError(t, err)

	var m map[string]any
	err = json.Unmarshal(result, &m)
	require.NoError(t, err)

	assert.Equal(t, "Alice", m["text"])
}

func TestReplacePlaceholders_InvalidJSON(t *testing.T) {
	raw := json.RawMessage(`not json`)

	_, err := ReplacePlaceholders(raw, nil, map[string]any{})
	assert.Error(t, err)
}

func TestExtractPlaceholders_Basic(t *testing.T) {
	raw := json.RawMessage(`{"nodes":{"1":{"inputs":{"seed":"{{seed}}","text":"{{positive_prompt}}"}}}}`)

	names, err := ExtractPlaceholders(raw)
	require.NoError(t, err)

	assert.Len(t, names, 2)
	assert.Contains(t, names, "seed")
	assert.Contains(t, names, "positive_prompt")
}

func TestExtractPlaceholders_NoPlaceholders(t *testing.T) {
	raw := json.RawMessage(`{"nodes":{"1":{"inputs":{"seed":42}}}}`)

	names, err := ExtractPlaceholders(raw)
	require.NoError(t, err)

	assert.Len(t, names, 0)
}

func TestExtractPlaceholders_Nested(t *testing.T) {
	raw := json.RawMessage(`[{"nested":{"deep":"{{deep_placeholder}}"}},{"shallow":"{{shallow}}"}]`)

	names, err := ExtractPlaceholders(raw)
	require.NoError(t, err)

	assert.Len(t, names, 2)
}
