package crawler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFetchReadable_ExtractsArticle(t *testing.T) {
	html := `<html><head><title>My Story</title></head><body>
		<nav>menu menu menu</nav>
		<article><h2>Chapter</h2><p>` + strings.Repeat("Real readable prose here. ", 40) + `</p></article>
	</body></html>`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(html))
	}))
	defer srv.Close()

	res := FetchReadable(srv.URL+"/story", FetchOptions{UserAgent: "UA/1"})
	assert.NoError(t, res.Error)
	assert.False(t, res.IsMediaWiki)
	assert.Contains(t, res.RawHTML, "readable prose")
	assert.NotEmpty(t, res.Title)
}
