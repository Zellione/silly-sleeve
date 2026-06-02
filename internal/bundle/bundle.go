package bundle

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
)

// Bundle holds all data to be serialized into a .slv file.
type Bundle struct {
	Manifest  project.ProjectManifest `json:"manifest"`
	Characters []compose.Character     `json:"characters"`
	Prompts    prompts.TemplateSet     `json:"prompts"`
	CrawlCache *crawler.CrawlResult    `json:"crawlCache"`
}

// WriteBundle serializes a project bundle as a .slv zip file.
func WriteBundle(filePath string, b Bundle) error {
	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("create bundle file: %w", err)
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	defer zw.Close()

	if err := writeJSON(zw, "manifest.json", b.Manifest); err != nil {
		return err
	}

	for i, ch := range b.Characters {
		name := fmt.Sprintf("characters/%d.json", ch.ID)
		if ch.ID == 0 {
			name = fmt.Sprintf("characters/%d.json", i+1)
		}
		if err := writeJSON(zw, name, sanitizeCharacter(ch)); err != nil {
			return fmt.Errorf("write character %d: %w", ch.ID, err)
		}
	}

	if err := writeJSON(zw, "prompts.json", b.Prompts); err != nil {
		return err
	}

	if b.CrawlCache != nil {
		if err := writeJSON(zw, "crawl_cache.json", b.CrawlCache); err != nil {
			return err
		}
	}

	return nil
}

// ReadBundle reads a .slv zip file and returns the project bundle.
func ReadBundle(filePath string) (Bundle, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return Bundle{}, fmt.Errorf("open bundle: %w", err)
	}
	defer r.Close()

	var b Bundle
	foundManifest := false

	for _, f := range r.File {
		switch f.Name {
		case "manifest.json":
			if err := readJSON(f, &b.Manifest); err != nil {
				return Bundle{}, fmt.Errorf("read manifest: %w", err)
			}
			foundManifest = true
		case "prompts.json":
			if err := readJSON(f, &b.Prompts); err != nil {
				return Bundle{}, fmt.Errorf("read prompts: %w", err)
			}
		case "crawl_cache.json":
			var cc crawler.CrawlResult
			if err := readJSON(f, &cc); err != nil {
				return Bundle{}, fmt.Errorf("read crawl cache: %w", err)
			}
			b.CrawlCache = &cc
		default:
			if isCharacterFile(f.Name) {
				var ch compose.Character
				if err := readJSON(f, &ch); err != nil {
					return Bundle{}, fmt.Errorf("read character %s: %w", f.Name, err)
				}
				b.Characters = append(b.Characters, ch)
			}
		}
	}

	if !foundManifest {
		return Bundle{}, fmt.Errorf("no manifest.json in bundle")
	}

	return b, nil
}

func writeJSON(zw *zip.Writer, name string, v any) error {
	w, err := zw.Create(name)
	if err != nil {
		return fmt.Errorf("create %s: %w", name, err)
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("encode %s: %w", name, err)
	}
	_, err = w.Write(data)
	return err
}

func readJSON(f *zip.File, v any) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	b, err := io.ReadAll(rc)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func isCharacterFile(name string) bool {
	prefix := "characters/"
	return len(name) > len(prefix) && name[:len(prefix)] == prefix && len(name) > 5 && name[len(name)-5:] == ".json"
}

func sanitizeCharacter(ch compose.Character) compose.Character {
	if len(ch.Tags) == 0 {
		ch.Tags = []string{}
	}
	if len(ch.Quotes) == 0 {
		ch.Quotes = []string{}
	}
	if len(ch.Stats) == 0 {
		ch.Stats = []compose.StatKV{}
	}
	return ch
}
