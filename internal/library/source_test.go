package library

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSourceShort(t *testing.T) {
	assert.Equal(t, "witcher · wiki", SourceShort("https://witcher.fandom.com/wiki/Ciri"))
	assert.Equal(t, "example.org", SourceShort("https://example.org/page"))
	assert.Equal(t, "", SourceShort(""))
	assert.Equal(t, "", SourceShort("::not a url::"))
}
