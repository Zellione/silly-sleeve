package llm

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompleterFunc_AdaptsFunction(t *testing.T) {
	var gotSys, gotUser string
	var c Completer = CompleterFunc(func(_ context.Context, _ LLMEndpoint, sys, user string) (string, error) {
		gotSys, gotUser = sys, user
		return "ok", nil
	})

	out, err := c.Complete(context.Background(), LLMEndpoint{}, "sys", "user")
	require.NoError(t, err)
	assert.Equal(t, "ok", out)
	assert.Equal(t, "sys", gotSys)
	assert.Equal(t, "user", gotUser)
}

func TestCompleterFunc_PropagatesError(t *testing.T) {
	sentinel := errors.New("boom")
	c := CompleterFunc(func(_ context.Context, _ LLMEndpoint, _, _ string) (string, error) {
		return "", sentinel
	})
	_, err := c.Complete(context.Background(), LLMEndpoint{}, "", "")
	assert.ErrorIs(t, err, sentinel)
}

func TestDefaultCompleter_NotNil(t *testing.T) {
	assert.NotNil(t, DefaultCompleter)
}
