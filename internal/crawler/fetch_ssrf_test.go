package crawler

import (
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	require.NoError(t, err)
	return u
}

func TestIsBlockedIP(t *testing.T) {
	cases := []struct {
		ip      string
		blocked bool
	}{
		{"127.0.0.1", true},       // loopback
		{"::1", true},             // loopback v6
		{"10.0.0.5", true},        // private
		{"192.168.1.1", true},     // private
		{"172.16.0.1", true},      // private
		{"169.254.169.254", true}, // link-local (cloud metadata)
		{"0.0.0.0", true},         // unspecified
		{"8.8.8.8", false},        // public
		{"151.101.0.1", false},    // public (fastly/fandom CDN range)
	}
	for _, c := range cases {
		ip := net.ParseIP(c.ip)
		require.NotNil(t, ip, "parse %s", c.ip)
		assert.Equal(t, c.blocked, isBlockedIP(ip), "ip=%s", c.ip)
	}
}

func TestNewSafeClient_BlocksRedirectToBlockedIP(t *testing.T) {
	// A (trusted) wiki host that maliciously redirects to the cloud metadata IP.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://169.254.169.254/latest/meta-data/", http.StatusFound)
	}))
	defer srv.Close()

	_, err := newSafeClient().Get(srv.URL)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "blocked address")
}

func TestCheckRedirectTarget(t *testing.T) {
	assert.Error(t, checkRedirectTarget(mustURL(t, "http://127.0.0.1/")))
	assert.Error(t, checkRedirectTarget(mustURL(t, "http://169.254.169.254/")))
	assert.Error(t, checkRedirectTarget(mustURL(t, "http://10.0.0.1/")))
	assert.Error(t, checkRedirectTarget(mustURL(t, "file:///etc/passwd")))
	assert.NoError(t, checkRedirectTarget(mustURL(t, "https://8.8.8.8/")))
}

func TestFetchPage_RejectsNonHTTPScheme(t *testing.T) {
	result := FetchPage("ftp://example.com/wiki/Page")
	require.Error(t, result.Error)
	assert.Contains(t, result.Error.Error(), "unsupported URL scheme")
}
