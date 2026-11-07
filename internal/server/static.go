package server

import (
	"net/http"
	"strings"
)

// handleStatic serves the built frontend from dist with an SPA fallback:
// any GET for a path without a file extension that has no matching file
// serves index.html.
func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	if s.dist == nil {
		http.Error(w, "frontend not built — run `npm run build` in frontend/", http.StatusServiceUnavailable)
		return
	}

	upath := strings.TrimPrefix(r.URL.Path, "/")
	if upath == "" {
		upath = "index.html"
	}
	if s.distHas(upath) {
		http.ServeFileFS(w, r, s.dist, upath)
		return
	}
	if i := strings.IndexByte(upath, '.'); i > 0 {
		// Looks like a file (has an extension) and it is missing.
		http.NotFound(w, r)
		return
	}
	// SPA fallback: client-side routes render from index.html.
	http.ServeFileFS(w, r, s.dist, "index.html")
}

func (s *Server) distHas(name string) bool {
	f, err := s.dist.Open(name)
	if err != nil {
		return false
	}
	_ = f.Close()
	return true
}
