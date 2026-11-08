package server

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func decodeJSON(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

func readAll(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	require.NoError(t, err)
	return string(b)
}

// newUploadTestServer builds a server with an isolated config dir.
func newUploadTestServer(t *testing.T) (*Server, string) {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", tmp)
	return New(testApp(t), nil), tmp
}

func doUpload(t *testing.T, s *Server, filename string, content []byte) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = fw.Write(content)
	require.NoError(t, err)
	require.NoError(t, mw.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	return rec
}

func TestUpload_StoresFileInUploadsDir(t *testing.T) {
	s, tmp := newUploadTestServer(t)
	rec := doUpload(t, s, "card.png", []byte("card-bytes"))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var res struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	require.NoError(t, decodeJSON(rec.Body.Bytes(), &res))
	assert.Equal(t, "card.png", res.Name)
	require.FileExists(t, res.Path)
	assert.Contains(t, res.Path, filepath.Join("silly-sleeve", "uploads"))
	assert.Contains(t, res.Path, tmp)
	assert.Equal(t, "card-bytes", readAll(t, res.Path))
}

func TestUpload_MultipleUploadsDoNotCollide(t *testing.T) {
	s, _ := newUploadTestServer(t)
	first := doUpload(t, s, "a.json", []byte("1"))
	second := doUpload(t, s, "a.json", []byte("2"))
	require.Equal(t, http.StatusOK, first.Code)
	require.Equal(t, http.StatusOK, second.Code)

	var p1, p2 struct{ Path string }
	require.NoError(t, decodeJSON(first.Body.Bytes(), &p1))
	require.NoError(t, decodeJSON(second.Body.Bytes(), &p2))
	assert.NotEqual(t, p1.Path, p2.Path)
}

func TestUpload_MaliciousFilenameIsContained(t *testing.T) {
	s, tmp := newUploadTestServer(t)
	rec := doUpload(t, s, "../../evil.png", []byte("x"))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var res struct{ Path string }
	require.NoError(t, decodeJSON(rec.Body.Bytes(), &res))
	abs, err := filepath.Abs(res.Path)
	require.NoError(t, err)
	// Must stay inside the config dir's uploads folder.
	uploads := filepath.Join(tmp, "silly-sleeve", "uploads")
	assert.True(t, strings.HasPrefix(abs, uploads+string(filepath.Separator)),
		"uploaded %q escaped uploads dir", abs)
}

func TestUpload_MissingField(t *testing.T) {
	s, _ := newUploadTestServer(t)
	// A multipart body that has a field, but not "file".
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	require.NoError(t, mw.WriteField("other", "value"))
	require.NoError(t, mw.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpload_NonMultipartBody(t *testing.T) {
	s, _ := newUploadTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/upload", strings.NewReader(""))
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
}

func TestDownload_ServesManagedFile(t *testing.T) {
	s, tmp := newUploadTestServer(t)
	exports := filepath.Join(tmp, "silly-sleeve", "exports")
	require.NoError(t, os.MkdirAll(exports, 0o700))
	file := filepath.Join(exports, "character.json")
	require.NoError(t, os.WriteFile(file, []byte(`{"spec":"chara_card_v2"}`), 0o644))

	req := httptest.NewRequest(http.MethodGet, "/api/download?path="+file, nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, `{"spec":"chara_card_v2"}`, rec.Body.String())
	cd := rec.Header().Get("Content-Disposition")
	assert.Contains(t, cd, "attachment")
	assert.Contains(t, cd, "character.json")
}

func TestDownload_RefusesPathsOutsideConfigDir(t *testing.T) {
	s, _ := newUploadTestServer(t)

	for _, target := range []string{
		"/etc/passwd",
		"/tmp/..",
		filepath.Join("..", "..", "etc", "passwd"),
	} {
		req := httptest.NewRequest(http.MethodGet, "/api/download?path="+target, nil)
		rec := httptest.NewRecorder()
		s.Handler().ServeHTTP(rec, req)
		assert.Equal(t, http.StatusForbidden, rec.Code, "target %q", target)
	}
}

func TestDownload_MissingFile404(t *testing.T) {
	s, tmp := newUploadTestServer(t)
	req := httptest.NewRequest(http.MethodGet,
		"/api/download?path="+filepath.Join(tmp, "silly-sleeve", "nope.json"), nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDownload_MissingPathParam(t *testing.T) {
	s, _ := newUploadTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/download", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
