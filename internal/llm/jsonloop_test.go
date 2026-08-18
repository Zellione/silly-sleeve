package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// scriptedCompleter pops one canned reply per call and records the prompts.
type scriptedCompleter struct {
	replies []string
	prompts []string
	err     error
}

func (s *scriptedCompleter) Complete(_ context.Context, _ LLMEndpoint, _, user string) (string, error) {
	s.prompts = append(s.prompts, user)
	if s.err != nil {
		return "", s.err
	}
	if len(s.replies) == 0 {
		return "", errors.New("scripted completer exhausted")
	}
	reply := s.replies[0]
	s.replies = s.replies[1:]
	return reply, nil
}

type parsed struct {
	A int `json:"a"`
}

func parseA(content string) (parsed, error) {
	var p parsed
	if err := json.Unmarshal([]byte(content), &p); err != nil {
		return parsed{}, fmt.Errorf("parse: %w", err)
	}
	if p.A == 0 {
		return parsed{}, errors.New("missing field a")
	}
	return p, nil
}

func TestCompleteJSON_FirstTrySucceedsWithoutNotes(t *testing.T) {
	c := &scriptedCompleter{replies: []string{`{"a": 1}`}}
	v, notes, err := CompleteJSON(context.Background(), c, LLMEndpoint{}, "sys", "user", parseA)
	require.NoError(t, err)
	assert.Equal(t, 1, v.A)
	assert.Empty(t, notes)
	assert.Len(t, c.prompts, 1)
}

func TestCompleteJSON_RepairRecoversWithoutRetry(t *testing.T) {
	c := &scriptedCompleter{replies: []string{`{"a": 1,}`}}
	v, notes, err := CompleteJSON(context.Background(), c, LLMEndpoint{}, "sys", "user", parseA)
	require.NoError(t, err)
	assert.Equal(t, 1, v.A)
	require.NotEmpty(t, notes)
	assert.Contains(t, notes[0], "repair")
	assert.Len(t, c.prompts, 1, "repair must not cost a second request")
}

func TestCompleteJSON_RetryRecoversWithErrorFeedback(t *testing.T) {
	c := &scriptedCompleter{replies: []string{"I cannot produce that, sorry.", `{"a": 2}`}}
	v, notes, err := CompleteJSON(context.Background(), c, LLMEndpoint{}, "sys", "user", parseA)
	require.NoError(t, err)
	assert.Equal(t, 2, v.A)
	require.Len(t, c.prompts, 2)
	assert.Contains(t, c.prompts[1], "user", "retry keeps the original prompt")
	assert.Contains(t, c.prompts[1], "I cannot produce that, sorry.", "retry shows the model its bad reply")
	assert.Contains(t, c.prompts[1], "ONLY the corrected JSON")
	require.NotEmpty(t, notes)
	assert.Contains(t, notes[0], "retr")
}

func TestCompleteJSON_RepairAlsoAppliesToRetryReply(t *testing.T) {
	c := &scriptedCompleter{replies: []string{"no json here", `{"a": 3,}`}}
	v, notes, err := CompleteJSON(context.Background(), c, LLMEndpoint{}, "sys", "user", parseA)
	require.NoError(t, err)
	assert.Equal(t, 3, v.A)
	assert.NotEmpty(t, notes)
}

func TestCompleteJSON_BothAttemptsFail(t *testing.T) {
	c := &scriptedCompleter{replies: []string{"garbage", "still garbage"}}
	_, _, err := CompleteJSON(context.Background(), c, LLMEndpoint{}, "sys", "user", parseA)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "retry")
	assert.Len(t, c.prompts, 2, "exactly one retry")
}

func TestCompleteJSON_CompleteErrorPropagatesWithoutRetry(t *testing.T) {
	c := &scriptedCompleter{err: errors.New("connection refused")}
	_, _, err := CompleteJSON(context.Background(), c, LLMEndpoint{}, "sys", "user", parseA)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "connection refused")
	assert.Len(t, c.prompts, 1, "a transport error must not trigger a retry")
}
