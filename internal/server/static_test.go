package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDist() *fstest.MapFS {
	return &fstest.MapFS{
		"index.html":       &fstest.MapFile{Data: []byte("<html>Silly Sleeve</html>")},
		"app.js":           &fstest.MapFile{Data: []byte("console.log('app')")},
		"assets/style.css": &fstest.MapFile{Data: []byte("body{}")},
	}
}

func getStatic(t *testing.T, s *Server, path string) (*httptest.ResponseRecorder, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	body, err := io.ReadAll(rec.Result().Body)
	require.NoError(t, err)
	return rec, string(body)
}

func TestStatic_RootServesIndex(t *testing.T) {
	s := New(testApp(t), testDist())
	rec, body := getStatic(t, s, "/")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, body, "Silly Sleeve")
}

func TestStatic_FileServed(t *testing.T) {
	s := New(testApp(t), testDist())
	rec, body := getStatic(t, s, "/assets/style.css")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "body{}", body)
}

func TestStatic_SPAFallback(t *testing.T) {
	s := New(testApp(t), testDist())
	rec, body := getStatic(t, s, "/some/client/route")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, body, "Silly Sleeve")
}

func TestStatic_MissingFile404(t *testing.T) {
	s := New(testApp(t), testDist())
	rec, _ := getStatic(t, s, "/missing.js")
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestStatic_NoDist503(t *testing.T) {
	s := New(testApp(t), nil)
	rec, body := getStatic(t, s, "/")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.Contains(t, body, "npm run build")
}
