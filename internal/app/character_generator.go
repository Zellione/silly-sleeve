package app

import (
	"context"
	"fmt"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/prompts"
	"silly-sleeve/internal/settings"
)

// CharacterGenerator owns the LLM-backed character generation logic decomposed
// out of App: bulk generation, per-field generation, and image-prompt
// generation. It is stateless with respect to App's character store — callers
// pass in the crawl, endpoint and existing character, and the generator returns
// the result. App keeps the mutex and character-store orchestration, so the
// LLM seam lives in one place (the natural home for an llm.Completer interface).
//
// ctx reads App's context lazily because it is only available after startup.
// completer is the injectable LLM seam; when nil the production HTTP completer
// is used.
type CharacterGenerator struct {
	ctx       func() context.Context
	completer llm.Completer
}

// completerOrDefault returns the injected completer, or the production
// HTTP-backed completer when none was set.
func (g *CharacterGenerator) completerOrDefault() llm.Completer {
	if g.completer != nil {
		return g.completer
	}
	return llm.DefaultCompleter
}

// toLLMEndpoint maps a stored settings endpoint to the llm package's endpoint.
func toLLMEndpoint(def settings.LLMEndpoint) llm.LLMEndpoint {
	return llm.LLMEndpoint{
		ID:           def.ID,
		Name:         def.Name,
		URL:          def.URL,
		Model:        def.Model,
		Key:          def.Key,
		ContextSize:  def.ContextSize,
		Temperature:  def.Temperature,
		SystemPrompt: def.SystemPrompt,
	}
}

// GenerateBulk generates a full character from the crawl via the bulk prompt.
// lockedFields are field IDs that must not be overwritten.
func (g *CharacterGenerator) GenerateBulk(crawl crawler.CrawlResult, def settings.LLMEndpoint, lockedFields []string, existing compose.Character) (compose.Character, error) {
	return compose.GenerateBulkWith(g.ctx(), g.completerOrDefault(), crawl, toLLMEndpoint(def), lockedFields, existing)
}

// GenerateField generates a single character field via a per-field prompt.
func (g *CharacterGenerator) GenerateField(fieldID, customPrompt string, crawl crawler.CrawlResult, def settings.LLMEndpoint, existing compose.Character, templates prompts.TemplateSet) (compose.Character, error) {
	return compose.GenerateFieldWith(g.ctx(), g.completerOrDefault(), toLLMEndpoint(def), compose.FieldRequest{
		FieldID:      fieldID,
		Result:       crawl,
		CustomPrompt: customPrompt,
		Existing:     existing,
		Templates:    templates,
	})
}

// GenerateImagePrompt generates positive/negative image-generation prompts for
// a character. style is "natural" or "danbooru".
func (g *CharacterGenerator) GenerateImagePrompt(target compose.Character, def settings.LLMEndpoint, style string) (string, string, error) {
	result, err := g.completerOrDefault().Complete(g.ctx(), toLLMEndpoint(def), buildImagePromptSysMsg(target, style), buildImagePromptUserMsg(target))
	if err != nil {
		return "", "", fmt.Errorf("generate image prompt: %w", err)
	}
	positive, negative := parseImagePromptResult(result)
	return positive, negative, nil
}
