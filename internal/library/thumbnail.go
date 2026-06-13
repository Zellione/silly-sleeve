package library

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
)

const thumbDir = "thumbnails"

// ThumbRef returns the stable cache filename for a project path. Keyed by the
// path (not content) so re-saving overwrites the same file with no orphans.
// SHA-256 here is a non-cryptographic filename hash, not a security primitive.
func ThumbRef(projectPath string) string {
	sum := sha256.Sum256([]byte(projectPath))
	return hex.EncodeToString(sum[:]) + ".png"
}

// WriteThumbnail caches data under baseDir/thumbnails/<ref> and returns the
// ref. Empty data writes nothing and returns "".
func WriteThumbnail(baseDir, projectPath string, data []byte) (string, error) {
	if len(data) == 0 {
		return "", nil
	}
	dir := filepath.Join(baseDir, thumbDir)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	ref := ThumbRef(projectPath)
	if err := os.WriteFile(filepath.Join(dir, ref), data, 0o600); err != nil {
		return "", err
	}
	return ref, nil
}

// ReadThumbnail returns the cached bytes for ref, or nil if ref is empty or
// the file is missing.
func ReadThumbnail(baseDir, ref string) []byte {
	if ref == "" {
		return nil
	}
	data, err := os.ReadFile(filepath.Join(baseDir, thumbDir, ref))
	if err != nil {
		return nil
	}
	return data
}

// DeleteThumbnail removes the cached file for ref (best-effort).
func DeleteThumbnail(baseDir, ref string) {
	if ref == "" {
		return
	}
	_ = os.Remove(filepath.Join(baseDir, thumbDir, ref))
}
