package app

import (
	"fmt"
	"strings"

	"silly-sleeve/internal/compose"
)

func buildImagePromptSysMsg(ch compose.Character, style string) string {
	switch style {
	case "danbooru":
		return `You are an expert AI image prompt engineer specializing in danbooru-style tag prompts. Given a character description, generate tags as comma-separated lists.

Output format:
POSITIVE: 1girl, solo, looking at viewer, ... [detailed tags based on character]
NEGATIVE: lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, deformed, ugly, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck`
	case "natural":
		return `You are an expert AI image prompt engineer. Given a character description, generate a vivid, detailed positive prompt and a concise negative prompt.

Output format exactly:
POSITIVE: (masterpiece, best quality, ultra detailed), ... [vivid natural language description of the character and scene]
NEGATIVE: bad anatomy, blurry, low quality, distorted proportions, deformed hands, extra limbs, watermark, signature, text`
	default:
		return fmt.Sprintf(`You are an expert AI image prompt engineer specializing in %s-style prompts. Generate a positive and negative prompt for the character.

Output format:
POSITIVE: [vivid description]
NEGATIVE: [things to avoid]`, style)
	}
}

func buildImagePromptUserMsg(ch compose.Character) string {
	var sb strings.Builder
	sb.WriteString("Generate image prompts for this character:\n\n")
	sb.WriteString(fmt.Sprintf("Name: %s\n", ch.Name))
	if ch.Appearance != "" {
		sb.WriteString(fmt.Sprintf("Appearance: %s\n", ch.Appearance))
	}
	if ch.Personality != "" {
		sb.WriteString(fmt.Sprintf("Personality: %s\n", ch.Personality))
	}
	if ch.Epithet != "" {
		sb.WriteString(fmt.Sprintf("Tags: %s\n", ch.Epithet))
	}
	return sb.String()
}

func parseImagePromptResult(result string) (string, string) {
	var positive, negative string

	lines := strings.Split(result, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "POSITIVE:") || strings.HasPrefix(trimmed, "positive:") {
			positive = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(trimmed, "POSITIVE:"), "positive:"))
		} else if strings.HasPrefix(trimmed, "NEGATIVE:") || strings.HasPrefix(trimmed, "negative:") {
			negative = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(trimmed, "NEGATIVE:"), "negative:"))
		}
	}

	if positive == "" {
		positive = fallbackPositiveFromLines(lines)
	}
	if negative == "" {
		negative = defaultNegativePrompt
	}

	return positive, negative
}

const defaultNegativePrompt = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, blurry, deformed"

func fallbackPositiveFromLines(lines []string) string {
	var sb strings.Builder
	for _, line := range lines {
		t := strings.TrimSpace(line)
		if t == "" {
			continue
		}
		if strings.HasPrefix(strings.ToUpper(t), "NEGATIVE") {
			break
		}
		if sb.Len() > 0 {
			sb.WriteString("\n")
		}
		sb.WriteString(t)
	}
	return sb.String()
}
