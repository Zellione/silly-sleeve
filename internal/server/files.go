package server

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"silly-sleeve/internal/library"
)

// maxUploadSize bounds a single browser→server file upload.
const maxUploadSize = 64 << 20 // 64 MiB

// uploadResult is returned by POST /api/upload.
type uploadResult struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

// handleUpload stores a multipart file ("file") in the managed uploads
// directory and returns the server-side path. Existing App methods that take
// a path (ReadImageFile-style flows) can then read it.
func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge,
			"upload too large or malformed: "+err.Error())
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "multipart field 'file' is required: "+err.Error())
		return
	}
	defer file.Close()

	cfgDir, err := library.ConfigDir()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	uploads := filepath.Join(cfgDir, "uploads")
	if err := os.MkdirAll(uploads, 0o700); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	name := sanitizeFileName(header.Filename)
	dst := filepath.Join(uploads, uuid.NewString()+"-"+name)

	out, err := os.Create(dst)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer out.Close()
	if _, err := io.Copy(out, file); err != nil {
		os.Remove(dst)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(uploadResult{Path: dst, Name: header.Filename})
}

// sanitizeFileName keeps only the base name and strips separators, so a
// crafted filename cannot escape the uploads directory.
func sanitizeFileName(name string) string {
	name = filepath.Base(filepath.Clean("/" + name))
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "upload"
	}
	return name
}

// handleDownload serves a file from the app data area (projects/, exports/,
// uploads/) as a browser download. The path must stay inside the config
// directory; anything else is refused.
func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("path")
	if p == "" {
		writeError(w, http.StatusBadRequest, "path query parameter is required")
		return
	}
	cfgDir, err := library.ConfigDir()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	clean := filepath.Clean(p)
	rel, err := filepath.Rel(cfgDir, clean)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		writeError(w, http.StatusForbidden, "path is outside the app data directory")
		return
	}
	st, err := os.Stat(clean)
	if err != nil || st.IsDir() {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	// strconv.Quote yields a double-quoted string with backslash escapes —
	// a valid RFC 6266 quoted-string for the filename parameter.
	w.Header().Set("Content-Disposition",
		"attachment; filename="+strconv.Quote(filepath.Base(clean)))
	http.ServeFile(w, r, clean)
}
