package compose

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCountTokens_Empty(t *testing.T) {
	assert.Equal(t, 0, CountTokens(""))
}

func TestCountTokens_SingleWord(t *testing.T) {
	n := CountTokens("hello")
	assert.GreaterOrEqual(t, n, 1)
	assert.LessOrEqual(t, n, 3)
}

func TestCountTokens_LongText(t *testing.T) {
	text := strings.Repeat("the quick brown fox jumps over the lazy dog. ", 20)
	n := CountTokens(text)
	assert.Greater(t, n, 100)
}

func TestCountTokens_NonEmptyReturnsPositive(t *testing.T) {
	cases := []string{
		"a",
		"hello world",
		"The name field should hold how the model addresses the character.",
		`Mid-height half-elf, mid-twenties in human years. Auburn hair cut at the shoulder.`,
	}
	for _, tc := range cases {
		n := CountTokens(tc)
		assert.Greater(t, n, 0, "input: %q", tc)
	}
}

func TestCountWords_Empty(t *testing.T) {
	assert.Equal(t, 0, CountWords(""))
}

func TestCountWords_WhitespaceOnly(t *testing.T) {
	assert.Equal(t, 0, CountWords("   \n\t  "))
}

func TestCountWords_SingleWord(t *testing.T) {
	assert.Equal(t, 1, CountWords("hello"))
}

func TestCountWords_MultipleWords(t *testing.T) {
	assert.Equal(t, 5, CountWords("the quick brown fox jumps"))
}

func TestCountWords_Newlines(t *testing.T) {
	assert.Equal(t, 5, CountWords("line one\nline two\nthree"))
}

func TestCountWords_LongText(t *testing.T) {
	text := "Mid-height half-elf, mid-twenties in human years."
	assert.Equal(t, 6, CountWords(text))
}
