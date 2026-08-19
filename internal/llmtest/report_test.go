package llmtest

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func reportMeta() RunMeta {
	return RunMeta{
		EndpointURL: "http://localhost:8001",
		Model:       "qwen2.5:7b/instruct",
		Runs:        3,
		Started:     time.Date(2026, 8, 19, 14, 30, 5, 0, time.UTC),
	}
}

func reportResults() []ScenarioResult {
	return []ScenarioResult{
		{
			Scenario: "bulk-generate",
			Label:    "Bulk character generation",
			Runs: []RunResult{
				{Run: 1, Exchanges: []Exchange{{System: "sys", User: "prompt", Response: `{"name":"Mira"}`}}, Summary: map[string]any{"candidates": 1}},
			},
			Findings: []Finding{
				{Scenario: "bulk-generate", Run: 1, Kind: "format", Msg: "invalid JSON forced a retry"},
				{Scenario: "bulk-generate", Kind: "consistency", Msg: "candidates varied across runs: 1, 3"},
			},
		},
		{
			Scenario: "endpoint-test",
			Label:    "Endpoint connectivity test",
			Runs:     []RunResult{{Run: 1, Summary: map[string]any{"ok": true}}},
		},
		{
			Scenario: "field-reroll",
			Label:    "Per-field reroll (personality)",
			Runs:     []RunResult{{Run: 1, Err: "dial tcp: connection refused"}},
			Findings: []Finding{
				{Scenario: "field-reroll", Run: 1, Kind: "transport", Msg: "dial tcp: connection refused"},
			},
		},
	}
}

func TestWriteReport_CreatesTimestampedFolderWithBothFiles(t *testing.T) {
	out := t.TempDir()

	dir, err := WriteReport(out, reportMeta(), reportResults())

	require.NoError(t, err)
	base := filepath.Base(dir)
	assert.True(t, strings.HasPrefix(base, "2026-08-19-143005-"), "folder starts with the run timestamp, got %s", base)
	assert.NotContains(t, base, ":", "model name must be sanitised for the filesystem")
	assert.NotContains(t, base, "/")
	assert.FileExists(t, filepath.Join(dir, "report.md"))
	assert.FileExists(t, filepath.Join(dir, "runs.jsonl"))
}

func TestWriteReport_CreatesMissingOutDir(t *testing.T) {
	out := filepath.Join(t.TempDir(), "docs", "llm-reports")

	dir, err := WriteReport(out, reportMeta(), reportResults())

	require.NoError(t, err)
	assert.DirExists(t, dir)
}

func TestWriteReport_FailsWhenOutDirIsAFile(t *testing.T) {
	out := filepath.Join(t.TempDir(), "blocker")
	require.NoError(t, os.WriteFile(out, []byte("x"), 0o600))

	_, err := WriteReport(out, reportMeta(), reportResults())

	require.Error(t, err)
}

func TestWriteReport_MarkdownOrdersWorstOffendersFirst(t *testing.T) {
	dir, err := WriteReport(t.TempDir(), reportMeta(), reportResults())
	require.NoError(t, err)

	md, err := os.ReadFile(filepath.Join(dir, "report.md"))
	require.NoError(t, err)
	text := string(md)

	assert.Contains(t, text, "http://localhost:8001")
	assert.Contains(t, text, "qwen2.5:7b/instruct")

	bulk := strings.Index(text, "Bulk character generation")
	reroll := strings.Index(text, "Per-field reroll")
	clean := strings.Index(text, "Endpoint connectivity test")
	require.Positive(t, bulk)
	require.Positive(t, reroll)
	require.Positive(t, clean)
	assert.Less(t, bulk, reroll, "two findings sort before one")
	assert.Less(t, reroll, clean, "clean scenarios come last")

	assert.Contains(t, text, "invalid JSON forced a retry")
	assert.Contains(t, text, "[consistency]")
	assert.Contains(t, text, "[transport]")
}

func TestWriteReport_JSONLCarriesMetaRunsAndFindings(t *testing.T) {
	dir, err := WriteReport(t.TempDir(), reportMeta(), reportResults())
	require.NoError(t, err)

	f, err := os.Open(filepath.Join(dir, "runs.jsonl"))
	require.NoError(t, err)
	defer f.Close()

	types := map[string]int{}
	var sawExchange bool
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		var line map[string]any
		require.NoError(t, json.Unmarshal(scanner.Bytes(), &line), "every line must be valid JSON")
		typ, _ := line["type"].(string)
		types[typ]++
		if typ == "run" {
			if exchanges, ok := line["exchanges"].([]any); ok && len(exchanges) > 0 {
				sawExchange = true
			}
		}
	}
	require.NoError(t, scanner.Err())

	assert.Equal(t, 1, types["meta"])
	assert.Equal(t, 3, types["run"], "one line per scenario run")
	assert.Equal(t, 2, types["findings"], "one findings line per scenario that has findings")
	assert.True(t, sawExchange, "run lines carry the raw request/response exchanges")
}

func TestNewReportDir_CreatesEmptyRunFolder(t *testing.T) {
	out := t.TempDir()

	dir, err := NewReportDir(out, reportMeta())

	require.NoError(t, err)
	assert.DirExists(t, dir)
	assert.True(t, strings.HasPrefix(filepath.Base(dir), "2026-08-19-143005-"))
}

func TestUpdateReport_OverwritesWithLatestResults(t *testing.T) {
	dir, err := NewReportDir(t.TempDir(), reportMeta())
	require.NoError(t, err)
	results := reportResults()

	require.NoError(t, UpdateReport(dir, reportMeta(), results[:1]))
	md1, err := os.ReadFile(filepath.Join(dir, "report.md"))
	require.NoError(t, err)
	assert.Contains(t, string(md1), "Bulk character generation")
	assert.NotContains(t, string(md1), "Endpoint connectivity test")

	require.NoError(t, UpdateReport(dir, reportMeta(), results))
	md2, err := os.ReadFile(filepath.Join(dir, "report.md"))
	require.NoError(t, err)
	assert.Contains(t, string(md2), "Endpoint connectivity test")
	assert.FileExists(t, filepath.Join(dir, "runs.jsonl"))
}
