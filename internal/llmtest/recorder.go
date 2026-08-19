package llmtest

import (
	"context"
	"time"

	"silly-sleeve/internal/llm"
)

// Recorder wraps a Completer and records every round trip, so the harness can
// analyse raw responses and count retries without touching production code.
type Recorder struct {
	base      llm.Completer
	Exchanges []Exchange
}

// NewRecorder wraps base in a recording completer.
func NewRecorder(base llm.Completer) *Recorder {
	return &Recorder{base: base}
}

// Complete forwards to the wrapped completer and records the exchange.
func (r *Recorder) Complete(ctx context.Context, ep llm.LLMEndpoint, system, user string) (string, error) {
	start := time.Now()
	content, err := r.base.Complete(ctx, ep, system, user)
	ex := Exchange{
		System:     system,
		User:       user,
		Response:   content,
		DurationMs: time.Since(start).Milliseconds(),
	}
	if err != nil {
		ex.Err = err.Error()
	}
	r.Exchanges = append(r.Exchanges, ex)
	return content, err
}
