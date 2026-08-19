package llmtest

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"silly-sleeve/internal/llm"
)

func TestRecorder_RecordsSuccessfulExchange(t *testing.T) {
	base := llm.CompleterFunc(func(_ context.Context, _ llm.LLMEndpoint, system, user string) (string, error) {
		return "reply to " + user, nil
	})
	rec := NewRecorder(base)

	got, err := rec.Complete(context.Background(), llm.LLMEndpoint{}, "sys", "hello")

	require.NoError(t, err)
	assert.Equal(t, "reply to hello", got)
	require.Len(t, rec.Exchanges, 1)
	assert.Equal(t, "sys", rec.Exchanges[0].System)
	assert.Equal(t, "hello", rec.Exchanges[0].User)
	assert.Equal(t, "reply to hello", rec.Exchanges[0].Response)
	assert.Empty(t, rec.Exchanges[0].Err)
}

func TestRecorder_RecordsFailedExchange(t *testing.T) {
	base := llm.CompleterFunc(func(context.Context, llm.LLMEndpoint, string, string) (string, error) {
		return "", errors.New("connection refused")
	})
	rec := NewRecorder(base)

	_, err := rec.Complete(context.Background(), llm.LLMEndpoint{}, "sys", "hello")

	require.Error(t, err)
	require.Len(t, rec.Exchanges, 1)
	assert.Equal(t, "connection refused", rec.Exchanges[0].Err)
	assert.Empty(t, rec.Exchanges[0].Response)
}

func TestRecorder_RecordsEveryCallInOrder(t *testing.T) {
	calls := 0
	base := llm.CompleterFunc(func(context.Context, llm.LLMEndpoint, string, string) (string, error) {
		calls++
		if calls == 1 {
			return "not json", nil
		}
		return `{"ok":true}`, nil
	})
	rec := NewRecorder(base)

	_, _ = rec.Complete(context.Background(), llm.LLMEndpoint{}, "s", "first")
	_, _ = rec.Complete(context.Background(), llm.LLMEndpoint{}, "s", "second")

	require.Len(t, rec.Exchanges, 2)
	assert.Equal(t, "first", rec.Exchanges[0].User)
	assert.Equal(t, "second", rec.Exchanges[1].User)
	assert.Equal(t, "not json", rec.Exchanges[0].Response)
	assert.Equal(t, `{"ok":true}`, rec.Exchanges[1].Response)
}
