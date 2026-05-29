package crawler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseMediaWikiURL_StandardFandom(t *testing.T) {
	domain, title, err := parseMediaWikiURL("https://baldursgate.fandom.com/wiki/Elara_Wynd")
	require.NoError(t, err)
	assert.Equal(t, "baldursgate.fandom.com", domain)
	assert.Equal(t, "Elara Wynd", title)
}

func TestParseMediaWikiURL_WithTrailingSlash(t *testing.T) {
	domain, title, err := parseMediaWikiURL("https://witcher.fandom.com/wiki/Geralt_of_Rivia/")
	require.NoError(t, err)
	assert.Equal(t, "witcher.fandom.com", domain)
	assert.Equal(t, "Geralt of Rivia", title)
}

func TestParseMediaWikiURL_WithUnderscores(t *testing.T) {
	domain, title, err := parseMediaWikiURL("https://wiki.example.com/wiki/My_Character_Name")
	require.NoError(t, err)
	assert.Equal(t, "wiki.example.com", domain)
	assert.Equal(t, "My Character Name", title)
}

func TestParseMediaWikiURL_NonWikiPath(t *testing.T) {
	domain, title, err := parseMediaWikiURL("https://example.com/my-page")
	require.NoError(t, err)
	assert.Equal(t, "example.com", domain)
	assert.Equal(t, "my-page", title)
}

func TestParseMediaWikiURL_InvalidURL(t *testing.T) {
	_, _, err := parseMediaWikiURL("not-a-url")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no host")
}

func TestParseMediaWikiURL_NoHost(t *testing.T) {
	_, _, err := parseMediaWikiURL("/wiki/NoHost")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no host")
}

func TestParseMediaWikiURL_EmptyPath(t *testing.T) {
	_, _, err := parseMediaWikiURL("https://example.com/")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "could not extract page title")
}

func TestParseMediaWikiURL_EncodedSpaces(t *testing.T) {
	domain, title, err := parseMediaWikiURL("https://wiki.test.com/wiki/Hello%20World")
	require.NoError(t, err)
	assert.Equal(t, "wiki.test.com", domain)
	assert.Equal(t, "Hello World", title)
}

func TestBuildParseURL(t *testing.T) {
	result := buildParseURL("example.fandom.com", "Test Page")
	assert.Contains(t, result, "example.fandom.com/api.php")
	assert.Contains(t, result, "action=parse")
	assert.Contains(t, result, "prop=text")
	assert.Contains(t, result, "format=json")
	assert.Contains(t, result, "Test%20Page")
}

func TestFetchPage_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api.php", r.URL.Path)
		assert.Equal(t, "parse", r.URL.Query().Get("action"))
		assert.Equal(t, "text", r.URL.Query().Get("prop"))
		assert.Equal(t, "json", r.URL.Query().Get("format"))

		resp := map[string]any{
			"parse": map[string]any{
				"title": "Elara_Wynd",
				"text":  map[string]any{"*": "<p>Test content</p>"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	defer srv.Close()

	result := FetchPage(srv.URL + "/wiki/Elara_Wynd")
	require.NoError(t, result.Error)
	assert.Equal(t, "Elara_Wynd", result.Title)
	assert.Equal(t, "<p>Test content</p>", result.RawHTML)
	assert.GreaterOrEqual(t, result.LatencyMs, int64(0))
}

func TestFetchPage_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
	}))
	defer srv.Close()

	result := FetchPage(srv.URL + "/wiki/Test")
	assert.Error(t, result.Error)
	assert.Contains(t, result.Error.Error(), "500")
}

func TestFetchPage_HTTP404(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))
	defer srv.Close()

	result := FetchPage(srv.URL + "/wiki/NotFound")
	assert.Error(t, result.Error)
	assert.Contains(t, result.Error.Error(), "404")
}

func TestFetchPage_InvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte("not json"))
		require.NoError(t, err)
	}))
	defer srv.Close()

	result := FetchPage(srv.URL + "/wiki/Test")
	assert.Error(t, result.Error)
	assert.Contains(t, result.Error.Error(), "parse response")
}

func TestFetchPage_EmptyResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"parse":{"title":"","text":{"*":""}}}`))
		require.NoError(t, err)
	}))
	defer srv.Close()

	result := FetchPage(srv.URL + "/wiki/Test")
	assert.Error(t, result.Error)
	assert.Contains(t, result.Error.Error(), "empty parse result")
}

func TestFetchPage_NetworkError(t *testing.T) {
	result := FetchPage("http://127.0.0.1:1/wiki/Test")
	assert.Error(t, result.Error)
}

func TestFetchPage_InvalidURL(t *testing.T) {
	result := FetchPage("://invalid")
	assert.Error(t, result.Error)
}

func TestFetchPage_LatencyRecorded(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"parse": map[string]any{
				"title": "Page",
				"text":  map[string]any{"*": "content"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	defer srv.Close()

	result := FetchPage(srv.URL + "/wiki/Page")
	require.NoError(t, result.Error)
	assert.GreaterOrEqual(t, result.LatencyMs, int64(0))
}

func TestFetchPage_DomainExtracted(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{
			"parse": map[string]any{
				"title": "Page",
				"text":  map[string]any{"*": "content"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	defer srv.Close()

	result := FetchPage(srv.URL + "/wiki/Page")
	require.NoError(t, result.Error)
	assert.NotEmpty(t, result.Domain)
	assert.NotEmpty(t, result.Title)
}
