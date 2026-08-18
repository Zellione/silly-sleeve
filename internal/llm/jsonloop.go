package llm

import (
	"context"
	"fmt"

	"silly-sleeve/internal/jsonrepair"
)

// retryInstruction is appended to the original prompt on the one retry,
// together with the model's failed reply and the parse error.
const retryInstruction = "Reply again with ONLY the corrected JSON — no commentary, no code fences."

// CompleteJSON runs a completion whose reply must parse as JSON, recovering
// from the failure modes of small local models. The parse callback owns the
// response shape (including any cleaning it already does); on its failure the
// reply is mechanically repaired and re-parsed, and if that also fails the
// model is re-prompted once with its bad reply and the parse error. The
// returned notes describe any recovery that was needed, phrased for the user;
// they are empty on the happy path.
func CompleteJSON[T any](
	ctx context.Context,
	c Completer,
	ep LLMEndpoint,
	system, user string,
	parse func(string) (T, error),
) (T, []string, error) {
	var zero T

	content, err := c.Complete(ctx, ep, system, user)
	if err != nil {
		return zero, nil, fmt.Errorf("llm complete: %w", err)
	}

	v, parseErr := parseWithRepair(content, parse)
	if parseErr == nil {
		var notes []string
		if v.repaired {
			notes = []string{"Model output was not valid JSON; automatic repair fixed it."}
		}
		return v.value, notes, nil
	}

	retryPrompt := fmt.Sprintf(
		"%s\n\nYour previous reply could not be parsed as JSON.\nPrevious reply:\n%s\n\nParse error: %v\n\n%s",
		user, content, parseErr, retryInstruction)

	content, err = c.Complete(ctx, ep, system, retryPrompt)
	if err != nil {
		return zero, nil, fmt.Errorf("llm complete (retry): %w", err)
	}

	v, parseErr = parseWithRepair(content, parse)
	if parseErr != nil {
		return zero, nil, fmt.Errorf("parse LLM response after retry: %w", parseErr)
	}
	return v.value, []string{"Model output was not valid JSON; a retry was needed."}, nil
}

type parseResult[T any] struct {
	value    T
	repaired bool
}

// parseWithRepair tries the caller's parser on the raw reply, then on a
// mechanically repaired copy. The raw attempt comes first so valid replies
// take exactly today's path.
func parseWithRepair[T any](content string, parse func(string) (T, error)) (parseResult[T], error) {
	v, err := parse(content)
	if err == nil {
		return parseResult[T]{value: v}, nil
	}

	repaired := jsonrepair.Repair(jsonrepair.Clean(content))
	if repaired != content {
		if v, repairErr := parse(repaired); repairErr == nil {
			return parseResult[T]{value: v, repaired: true}, nil
		}
	}
	return parseResult[T]{}, err
}
