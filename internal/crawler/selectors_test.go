package crawler

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSectionsFromSelectors(t *testing.T) {
	html := `<div class="mw-parser-output">
		<h2>Bio</h2><p>First paragraph.</p>
		<aside class="nav">skip me</aside>
		<p>Second paragraph.</p>
	</div>`
	secs := SectionsFromSelectors(html, []string{".mw-parser-output > p"})
	assert.Len(t, secs, 2)
	assert.Equal(t, "First paragraph.", secs[0].Body)
	assert.Equal(t, "Second paragraph.", secs[1].Body)
}

func TestSectionsFromSelectors_EmptyOnNoMatch(t *testing.T) {
	secs := SectionsFromSelectors(`<p>x</p>`, []string{".nope"})
	assert.Empty(t, secs)
}

func TestSameDomainLinks(t *testing.T) {
	html := `<div class="mw-parser-output">
		<p><a href="/wiki/Alpha">Alpha</a> and <a href="/wiki/Beta">Beta</a></p>
		<p><a href="https://other.com/wiki/X">External</a></p>
		<p><a href="/wiki/Alpha">dup</a></p>
		<p><a href="/wiki/Special:Random">special</a></p>
	</div>`
	links := SameDomainLinks(html, "https://w.fandom.com/wiki/Root")
	assert.Equal(t, []string{
		"https://w.fandom.com/wiki/Alpha",
		"https://w.fandom.com/wiki/Beta",
	}, links)
}
