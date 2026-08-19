package llmtest

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/llm"
)

// stubLLM serves an OpenAI-compatible chat completions endpoint whose reply
// content comes from the given function.
func stubLLM(t *testing.T, content func(callIndex int, userPrompt string) string) (*httptest.Server, llm.LLMEndpoint) {
	t.Helper()
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		user := ""
		for _, m := range req.Messages {
			if m.Role == "user" {
				user = m.Content
			}
		}
		reply := content(calls, user)
		calls++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"content": reply}}},
		})
	}))
	t.Cleanup(srv.Close)
	return srv, llm.LLMEndpoint{URL: srv.URL, Model: "stub-model"}
}

func fullBulkJSON() string {
	return `{"name":"Mira Dawnhollow","epithet":"The Last Lamplighter",` +
		`"tags":["lamplighter"],"appearance":"Copper hair and soot-grey eyes.",` +
		`"personality":"Cheerful but haunted.","backstory":"Inherited the lanterns.",` +
		`"abilities":"Senses the mist.","relationships":"Daughter of Serah.",` +
		`"quotes":["Forty-nine lights."],"altGreetings":[],` +
		`"stats":[["Class","Lamplighter"]]}`
}

func findScenario(t *testing.T, id string) Scenario {
	t.Helper()
	for _, s := range Scenarios() {
		if s.ID == id {
			return s
		}
	}
	t.Fatalf("scenario %q not registered", id)
	return Scenario{}
}

func TestScenarios_RegistersCharacterScenarios(t *testing.T) {
	ids := make([]string, 0)
	for _, s := range Scenarios() {
		ids = append(ids, s.ID)
		assert.NotEmpty(t, s.Label, "scenario %s needs a label", s.ID)
		assert.NotNil(t, s.Run, "scenario %s needs a Run", s.ID)
	}
	assert.Contains(t, ids, "endpoint-test")
	assert.Contains(t, ids, "bulk-generate")
	assert.Contains(t, ids, "field-reroll")
}

func TestEndpointScenario_ReportsOkAndLatency(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string { return "hi" })
	s := findScenario(t, "endpoint-test")

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, NewRecorder(llm.DefaultCompleter))

	require.NoError(t, err)
	assert.Equal(t, true, summary["ok"])
	assert.NotNil(t, summary["latencyMs"])
}

func TestEndpointScenario_FailsOnUnreachableEndpoint(t *testing.T) {
	s := findScenario(t, "endpoint-test")
	srv, ep := stubLLM(t, func(int, string) string { return "hi" })
	srv.Close() // the freed port now refuses connections immediately
	cfg := Config{Endpoint: ep}

	_, err := s.Run(context.Background(), cfg, NewRecorder(llm.DefaultCompleter))

	require.Error(t, err)
}

func TestBulkGenerateScenario_SummarizesFilledFields(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string { return fullBulkJSON() })
	s := findScenario(t, "bulk-generate")
	rec := NewRecorder(llm.DefaultCompleter)

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, rec)

	require.NoError(t, err)
	assert.True(t, s.ExpectJSON)
	require.Len(t, rec.Exchanges, 1)

	chars, ok := summary["fieldChars"].(map[string]int)
	require.True(t, ok, "summary carries per-field character counts")
	assert.Positive(t, chars["personality"])
	assert.Empty(t, summary["missingRequired"])
	assert.Empty(t, s.Check(summary))
}

func TestBulkGenerateScenario_FlagsMissingRequiredFields(t *testing.T) {
	reply := `{"name":"Mira","appearance":"","personality":"","tags":[]}`
	_, ep := stubLLM(t, func(int, string) string { return reply })
	s := findScenario(t, "bulk-generate")

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, NewRecorder(llm.DefaultCompleter))

	require.NoError(t, err)
	missing, ok := summary["missingRequired"].([]string)
	require.True(t, ok)
	assert.Contains(t, missing, "appearance")
	assert.Contains(t, missing, "personality")

	problems := s.Check(summary)
	require.NotEmpty(t, problems)
	assert.Contains(t, problems[0], "appearance")
}

func TestFieldRerollScenario_ReturnsRerolledFieldLength(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string {
		return `"A brand new personality, still cheerful."`
	})
	s := findScenario(t, "field-reroll")
	rec := NewRecorder(llm.DefaultCompleter)

	summary, err := s.Run(context.Background(), Config{Endpoint: ep}, rec)

	require.NoError(t, err)
	assert.Equal(t, "personality", summary["field"])
	chars, ok := summary["chars"].(int)
	require.True(t, ok)
	assert.Positive(t, chars)
	assert.Empty(t, s.Check(summary))
}

func TestFieldRerollScenario_FlagsEmptyResult(t *testing.T) {
	s := findScenario(t, "field-reroll")

	problems := s.Check(map[string]any{"field": "personality", "chars": 0})

	require.NotEmpty(t, problems)
	assert.Contains(t, problems[0], "empty")
}

func TestExecute_AppendsAnalysisFindings(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string {
		return "```json\n" + fullBulkJSON() + "\n```"
	})
	cfg := Config{Runs: 1, Endpoint: ep}

	results := Execute(context.Background(), cfg, []Scenario{findScenario(t, "bulk-generate")})

	require.Len(t, results, 1)
	msgs := findingMessages(results[0].Findings)
	require.NotEmpty(t, msgs)
	assert.Contains(t, msgs[0], "not bare JSON")
}

func TestEndpointScenario_IsCritical(t *testing.T) {
	assert.True(t, findScenario(t, "endpoint-test").Critical,
		"an unreachable endpoint must stop the remaining scenarios")
	assert.False(t, findScenario(t, "bulk-generate").Critical)
}
