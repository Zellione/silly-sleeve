package llmtest

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func runCLI(t *testing.T, args ...string) (int, string, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := RunCLI(args, &stdout, &stderr)
	return code, stdout.String(), stderr.String()
}

func TestDefaultEndpointURL(t *testing.T) {
	assert.Equal(t, "http://localhost:8001/v1", DefaultEndpointURL)
}

func TestRunCLI_ListPrintsAllScenarios(t *testing.T) {
	code, stdout, _ := runCLI(t, "-list")

	assert.Equal(t, 0, code)
	for _, s := range Scenarios() {
		assert.Contains(t, stdout, s.ID)
	}
}

func TestRunCLI_RejectsUnknownFlag(t *testing.T) {
	code, _, stderr := runCLI(t, "-definitely-not-a-flag")

	assert.NotEqual(t, 0, code)
	assert.NotEmpty(t, stderr)
}

func TestRunCLI_RejectsNonPositiveRuns(t *testing.T) {
	code, _, stderr := runCLI(t, "-runs", "0")

	assert.Equal(t, 1, code)
	assert.Contains(t, stderr, "-runs")
}

func TestRunCLI_RejectsUnknownScenarioInOnly(t *testing.T) {
	code, _, stderr := runCLI(t, "-only", "bulk-generate,no-such-scenario")

	assert.Equal(t, 1, code)
	assert.Contains(t, stderr, "no-such-scenario")
	assert.Contains(t, stderr, "bulk-generate", "the error lists the valid scenario IDs")
}

func TestRunCLI_EndToEndAgainstStub(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string { return fullBulkJSON() })
	out := filepath.Join(t.TempDir(), "reports")

	code, stdout, stderr := runCLI(t,
		"-endpoint", ep.URL,
		"-model", "stub-model",
		"-runs", "2",
		"-only", "bulk-generate",
		"-out", out,
	)

	assert.Equal(t, 0, code, "stderr: %s", stderr)
	assert.Contains(t, stdout, "bulk-generate")

	entries, err := os.ReadDir(out)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	reportDir := filepath.Join(out, entries[0].Name())
	assert.FileExists(t, filepath.Join(reportDir, "report.md"))
	assert.FileExists(t, filepath.Join(reportDir, "runs.jsonl"))
	assert.Contains(t, stdout, reportDir, "the CLI prints where the report landed")
	assert.Contains(t, entries[0].Name(), "stub-model")
}

func TestRunCLI_ReportsFindingCounts(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string {
		return "```json\n" + fullBulkJSON() + "\n```"
	})

	code, stdout, _ := runCLI(t,
		"-endpoint", ep.URL,
		"-runs", "1",
		"-only", "bulk-generate",
		"-out", filepath.Join(t.TempDir(), "reports"),
	)

	assert.Equal(t, 0, code, "findings do not fail the process; they are the product")
	assert.Contains(t, stdout, "1 finding")
}

func TestRunCLI_FailsWhenReportCannotBeWritten(t *testing.T) {
	_, ep := stubLLM(t, func(int, string) string { return fullBulkJSON() })
	blocker := filepath.Join(t.TempDir(), "blocker")
	require.NoError(t, os.WriteFile(blocker, []byte("x"), 0o600))

	code, _, stderr := runCLI(t,
		"-endpoint", ep.URL,
		"-runs", "1",
		"-only", "bulk-generate",
		"-out", blocker,
	)

	assert.Equal(t, 1, code)
	assert.NotEmpty(t, stderr)
}

func TestRunCLI_ForceJSONReachesTheEndpoint(t *testing.T) {
	var sawResponseFormat bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		if _, ok := body["response_format"]; ok {
			sawResponseFormat = true
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"content": fullBulkJSON()}}},
		})
	}))
	t.Cleanup(srv.Close)

	code, _, _ := runCLI(t,
		"-endpoint", srv.URL,
		"-runs", "1",
		"-only", "bulk-generate",
		"-force-json",
		"-out", filepath.Join(t.TempDir(), "reports"),
	)

	assert.Equal(t, 0, code)
	assert.True(t, sawResponseFormat, "-force-json must put response_format on the request")
}

func TestRunCLI_UsageMentionsDefaults(t *testing.T) {
	code, _, stderr := runCLI(t, "-h")

	assert.Equal(t, 0, code, "asking for help is not an error")
	assert.True(t, strings.Contains(stderr, DefaultEndpointURL), "usage documents the default endpoint")
}
