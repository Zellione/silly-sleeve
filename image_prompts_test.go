package main

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"silly-sleeve/internal/compose"
)

func TestBuildImagePromptSysMsg_Natural(t *testing.T) {
	ch := compose.Character{Name: "Elara", Appearance: "auburn hair", Personality: "cheerful"}
	result := buildImagePromptSysMsg(ch, "natural")
	assert.Contains(t, result, "masterpiece")
	assert.Contains(t, result, "best quality")
	assert.NotContains(t, result, "danbooru")
}

func TestBuildImagePromptSysMsg_Danbooru(t *testing.T) {
	ch := compose.Character{Name: "Elara"}
	result := buildImagePromptSysMsg(ch, "danbooru")
	assert.Contains(t, result, "1girl")
	assert.Contains(t, result, "lowres")
	assert.Contains(t, result, "danbooru")
}

func TestBuildImagePromptSysMsg_Default(t *testing.T) {
	ch := compose.Character{Name: "Elara"}
	result := buildImagePromptSysMsg(ch, "unknown-style")
	assert.Contains(t, result, "unknown-style")
}

func TestBuildImagePromptUserMsg(t *testing.T) {
	ch := compose.Character{
		Name:        "Elara",
		Appearance:  "auburn hair, green eyes",
		Personality: "cheerful, brave",
		Epithet:     "Crimson Lark",
	}
	result := buildImagePromptUserMsg(ch)
	assert.Contains(t, result, "Elara")
	assert.Contains(t, result, "auburn hair")
	assert.Contains(t, result, "cheerful")
	assert.Contains(t, result, "Crimson Lark")
}

func TestParseImagePromptResult(t *testing.T) {
	result := `POSITIVE: masterpiece, best quality, 1girl, auburn hair
NEGATIVE: lowres, bad anatomy, blurry`

	positive, negative := parseImagePromptResult(result)
	assert.Equal(t, "masterpiece, best quality, 1girl, auburn hair", positive)
	assert.Equal(t, "lowres, bad anatomy, blurry", negative)
}

func TestParseImagePromptResult_Lowercase(t *testing.T) {
	result := `positive: cute cat
negative: ugly`

	positive, negative := parseImagePromptResult(result)
	assert.Equal(t, "cute cat", positive)
	assert.Equal(t, "ugly", negative)
}

func TestParseImagePromptResult_NoExplicitTags(t *testing.T) {
	result := "a beautiful portrait of a character in a forest"

	positive, negative := parseImagePromptResult(result)
	assert.Equal(t, "a beautiful portrait of a character in a forest", positive)
	assert.NotEmpty(t, negative)
}

func TestParseImagePromptResult_OnlyPositive(t *testing.T) {
	result := "POSITIVE: masterpiece, 1girl"

	positive, negative := parseImagePromptResult(result)
	assert.Equal(t, "masterpiece, 1girl", positive)
	assert.NotEmpty(t, negative)
}
