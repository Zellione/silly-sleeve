package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"silly-sleeve/internal/app"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	return New(app.NewApp(), nil)
}

func rpcCall(t *testing.T, s *Server, method string, args ...any) (*httptest.ResponseRecorder, []byte) {
	t.Helper()
	body := []byte("[]")
	if args != nil {
		enc, err := json.Marshal(args)
		require.NoError(t, err)
		body = enc
	}
	req := httptest.NewRequest(http.MethodPost, "/api/"+method, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	data, err := io.ReadAll(rec.Result().Body)
	require.NoError(t, err)
	return rec, data
}

func TestDispatch_SimpleGetter(t *testing.T) {
	s := newTestServer(t)
	rec, data := rpcCall(t, s, "CountTokens", "hello world")
	assert.Equal(t, http.StatusOK, rec.Code)
	var n int
	require.NoError(t, json.Unmarshal(data, &n))
	assert.Greater(t, n, 0)
}

func TestDispatch_TwoArgsAndStateRoundTrip(t *testing.T) {
	s := newTestServer(t)
	rec, _ := rpcCall(t, s, "SetProjectFieldEndpoint", "tags", 5)
	assert.Equal(t, http.StatusOK, rec.Code)

	rec, data := rpcCall(t, s, "GetProjectFieldEndpoints")
	require.Equal(t, http.StatusOK, rec.Code)
	var m map[string]int
	require.NoError(t, json.Unmarshal(data, &m))
	assert.Equal(t, map[string]int{"tags": 5}, m)
}

func TestDispatch_StructArg(t *testing.T) {
	s := newTestServer(t)
	rec, _ := rpcCall(t, s, "SaveCrawlState", map[string]any{
		"url":   "https://example.com/page",
		"roles": map[string]string{"https://example.com/page": "character"},
	})
	require.Equal(t, http.StatusOK, rec.Code)

	rec, data := rpcCall(t, s, "GetCrawlState")
	require.Equal(t, http.StatusOK, rec.Code)
	var st struct {
		URL   string            `json:"url"`
		Roles map[string]string `json:"roles"`
	}
	require.NoError(t, json.Unmarshal(data, &st))
	assert.Equal(t, "https://example.com/page", st.URL)
	assert.Equal(t, map[string]string{"https://example.com/page": "character"}, st.Roles)
}

func TestDispatch_MethodError(t *testing.T) {
	s := newTestServer(t)
	rec, data := rpcCall(t, s, "UpdateCharacter", map[string]any{"id": 999, "name": "X"})
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	var body struct {
		Error string `json:"error"`
	}
	require.NoError(t, json.Unmarshal(data, &body))
	assert.Contains(t, body.Error, "999")
}

func TestDispatch_UnknownMethod(t *testing.T) {
	s := newTestServer(t)
	rec, data := rpcCall(t, s, "NoSuchMethod")
	assert.Equal(t, http.StatusNotFound, rec.Code)
	var body struct {
		Error string `json:"error"`
	}
	require.NoError(t, json.Unmarshal(data, &body))
	assert.Contains(t, body.Error, "NoSuchMethod")
}

func TestDispatch_WrongArgCount(t *testing.T) {
	s := newTestServer(t)
	rec, _ := rpcCall(t, s, "CountTokens") // takes 1, got 0
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDispatch_BadJSON(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/CountTokens", bytes.NewReader([]byte(`{not json`)))
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDispatch_LifecycleMethodExcluded(t *testing.T) {
	s := newTestServer(t)
	rec, data := rpcCall(t, s, "SetEventSink", []any{})
	assert.Equal(t, http.StatusNotFound, rec.Code)
	var body struct {
		Error string `json:"error"`
	}
	require.NoError(t, json.Unmarshal(data, &body))
	assert.Contains(t, body.Error, "SetEventSink")
}

func TestDispatch_VoidMethodReturnsNull(t *testing.T) {
	s := newTestServer(t)
	rec, data := rpcCall(t, s, "SetActiveCharacter", 1)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, "null", string(bytes.TrimSpace(data)))
}

func TestDispatch_NilPointerReturn(t *testing.T) {
	s := newTestServer(t)
	rec, data := rpcCall(t, s, "GetCachedCrawl")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, "null", string(bytes.TrimSpace(data)))
}

func TestDispatch_Health(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"ok":true}`, rec.Body.String())
}

func TestDispatch_MethodOnlyAcceptsPost(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/CountTokens", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	// The wildcard route only matches POST; GET falls through to static
	// (disabled in tests → 503), which is the observable "not an RPC route".
	assert.NotEqual(t, http.StatusOK, rec.Code)
}
