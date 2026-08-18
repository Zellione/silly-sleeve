package app

import (
	"bytes"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	old := logOut
	logOut = &buf
	t.Cleanup(func() { logOut = old })
	return &buf
}

func TestLogfAlwaysWritesToTheConsole(t *testing.T) {
	buf := captureLog(t)
	logf("something failed: %s", "boom")
	assert.Contains(t, buf.String(), "something failed: boom")
}

func TestDebugfIsGatedByTheDebugFlag(t *testing.T) {
	buf := captureLog(t)
	old := debugEnabled
	t.Cleanup(func() { debugEnabled = old })

	debugEnabled = false
	debugf("hidden %d", 1)
	assert.Empty(t, buf.String())

	debugEnabled = true
	debugf("shown %d", 2)
	assert.Contains(t, buf.String(), "shown 2")
	assert.Contains(t, buf.String(), "[debug]")
}

func TestExtractFailureIsLoggedToTheConsole(t *testing.T) {
	buf := captureLog(t)
	a := newLoreApp("", errors.New("model exploded"))
	stageLore(t, a)

	_, err := a.ExtractLorebookCandidates("https://w/wiki/Lore")
	require.Error(t, err)
	assert.Contains(t, buf.String(), "model exploded")
	assert.Contains(t, buf.String(), "https://w/wiki/Lore")
}
