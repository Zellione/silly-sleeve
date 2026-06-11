package llm

import "context"

// Completer sends a chat completion request and returns the message content.
// It is the injectable seam over the network call, so generation logic can be
// unit-tested with a fake instead of a real HTTP endpoint.
type Completer interface {
	Complete(ctx context.Context, ep LLMEndpoint, systemPrompt, userPrompt string) (string, error)
}

// CompleterFunc adapts an ordinary function to the Completer interface.
type CompleterFunc func(ctx context.Context, ep LLMEndpoint, systemPrompt, userPrompt string) (string, error)

// Complete implements Completer.
func (f CompleterFunc) Complete(ctx context.Context, ep LLMEndpoint, systemPrompt, userPrompt string) (string, error) {
	return f(ctx, ep, systemPrompt, userPrompt)
}

// DefaultCompleter is the production HTTP-backed completer (the package-level
// Complete function).
var DefaultCompleter Completer = CompleterFunc(Complete)
