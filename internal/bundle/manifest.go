package bundle

import (
	"archive/zip"
	"fmt"

	"silly-sleeve/internal/project"
)

// ReadManifest reads only manifest.json from a bundle, skipping characters,
// images, and crawl data. Callers that need just the metadata (e.g. to
// preserve createdAt across re-saves) avoid the full ReadBundle cost.
func ReadManifest(filePath string) (project.ProjectManifest, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return project.ProjectManifest{}, err
	}
	defer r.Close()

	var cumulative int64
	for _, f := range r.File {
		if f.Name == "manifest.json" {
			var m project.ProjectManifest
			if err := readJSON(f, &m, &cumulative); err != nil {
				return project.ProjectManifest{}, err
			}
			return m, nil
		}
	}
	return project.ProjectManifest{}, fmt.Errorf("bundle has no manifest.json")
}
