package compose

import (
	"github.com/pkoukk/tiktoken-go"
)

var tokenEncoding *tiktoken.Tiktoken

func init() {
	var err error
	tokenEncoding, err = tiktoken.GetEncoding("cl100k_base")
	if err != nil {
		tokenEncoding = nil
	}
}

// CountTokens returns the approximate token count for the given text
// using the cl100k_base encoding (same as GPT-4 / GPT-3.5-turbo).
func CountTokens(text string) int {
	if tokenEncoding == nil {
		return len(text) / 4
	}
	tokens := tokenEncoding.Encode(text, nil, nil)
	return len(tokens)
}

// CountWords returns the number of words in text.
func CountWords(text string) int {
	if len(text) == 0 {
		return 0
	}
	inWord := false
	count := 0
	for _, ch := range text {
		if ch == ' ' || ch == '\n' || ch == '\t' || ch == '\r' {
			inWord = false
		} else if !inWord {
			inWord = true
			count++
		}
	}
	return count
}

// CharacterTokens returns the total token count across a character's
// free-text fields. Used for the dashboard's per-project token figure.
func CharacterTokens(ch Character) int {
	total := 0
	for _, s := range []string{
		ch.Name, ch.Epithet, ch.Appearance, ch.Personality,
		ch.Backstory, ch.Abilities, ch.Relationships,
	} {
		total += CountTokens(s)
	}
	for _, q := range ch.Quotes {
		total += CountTokens(q)
	}
	return total
}
