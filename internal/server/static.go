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
	// Defense in depth for the path-traversal rule: the embedded dist is an
	// fs.FS, whose Open rejects any name containing ".."; reject such names
	// here as well so the invariant is explicit and checked in one place.
	if strings.Contains(upath, "..") {
		http.NotFound(w, r)
		return
	}
	if s.distHas(upath) {
		// NOSONAR path traversal: upath is checked for ".." above and s.dist
		// is an embedded fs.FS whose Open rejects traversal names by contract.
		http.ServeFileFS(w, r, s.dist, upath) // NOSONAR
		return
	}
	// A name with a dot after the first character looks like a file with an
	// extension: if it is missing, that is a real 404.
	if strings.IndexByte(upath, '.') > 0 {
		http.NotFound(w, r)
		return
	}
	// SPA fallback: client-side routes render from index.html.
	http.ServeFileFS(w, r, s.dist, "index.html")
}

func (s *Server) distHas(name string) bool {
	// NOSONAR: name is caller-checked against the dist fs.FS, which rejects
	// traversal names by contract.
	f, err := s.dist.Open(name) // NOSONAR
	if err != nil {
		return false
	}
	_ = f.Close()
	return true
}
