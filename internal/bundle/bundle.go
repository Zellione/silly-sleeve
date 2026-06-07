package bundle

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
)

const manifestFile = "manifest.json"

// Bundle holds all data to be serialized into a .slv file.
type Bundle struct {
	Manifest   project.ProjectManifest `json:"manifest"`
	Characters []compose.Character     `json:"characters"`
	Lorebook   []lorebook.Entry        `json:"lorebook"`
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

	manifest := b.Manifest
	projectImage := manifest.ProjectImage
	manifest.ProjectImage = nil

	if err := writeJSON(zw, manifestFile, manifest); err != nil {
		return err
	}

	if len(projectImage) > 0 {
		if err := writeBytes(zw, "images/project.png", projectImage); err != nil {
			return fmt.Errorf("write project image: %w", err)
		}
	}

	for i, ch := range b.Characters {
		portrait := ch.Portrait
		sanitized := sanitizeCharacter(ch)
		sanitized.Portrait = nil

		name := fmt.Sprintf("characters/%d.json", sanitized.ID)
		if sanitized.ID == 0 {
			name = fmt.Sprintf("characters/%d.json", i+1)
		}
		if err := writeJSON(zw, name, sanitized); err != nil {
			return fmt.Errorf("write character %d: %w", sanitized.ID, err)
		}

		if len(portrait) > 0 {
			imgName := fmt.Sprintf("images/portrait_%d.png", sanitized.ID)
			if sanitized.ID == 0 {
				imgName = fmt.Sprintf("images/portrait_%d.png", i+1)
			}
			if err := writeBytes(zw, imgName, portrait); err != nil {
				return fmt.Errorf("write portrait %d: %w", sanitized.ID, err)
			}
		}
	}

	if err := writeJSON(zw, "prompts.json", b.Prompts); err != nil {
		return err
	}

	if err := writeJSON(zw, "lorebook.json", b.Lorebook); err != nil {
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

	b := Bundle{}
	fileReaders := map[string]func(*zip.File) error{
		manifestFile:       func(f *zip.File) error { return readJSON(f, &b.Manifest) },
		"prompts.json":     func(f *zip.File) error { return readJSON(f, &b.Prompts) },
		"lorebook.json":    func(f *zip.File) error { return readJSON(f, &b.Lorebook) },
		"crawl_cache.json": func(f *zip.File) error { return readCrawlCache(f, &b) },
	}

	foundManifest := false

	for _, f := range r.File {
		if reader, ok := fileReaders[f.Name]; ok {
			if err := reader(f); err != nil {
				return Bundle{}, fmt.Errorf("read %s: %w", f.Name, err)
			}
			if f.Name == manifestFile {
				foundManifest = true
			}
		} else if isCharacterFile(f.Name) {
			if err := readCharacterFile(f, &b); err != nil {
				return Bundle{}, fmt.Errorf("read character %s: %w", f.Name, err)
			}
		}
	}

	if !foundManifest {
		return Bundle{}, fmt.Errorf("no manifest.json in bundle")
	}

	for _, f := range r.File {
		if f.Name == "images/project.png" {
			data, err := readBytes(f)
			if err != nil {
				return Bundle{}, fmt.Errorf("read project image: %w", err)
			}
			b.Manifest.ProjectImage = data
		} else if isPortraitFile(f.Name) {
			id, err := portraitIDFromName(f.Name)
			if err != nil {
				continue
			}
			data, err := readBytes(f)
			if err != nil {
				return Bundle{}, fmt.Errorf("read portrait %d: %w", id, err)
			}
			for i := range b.Characters {
				if b.Characters[i].ID == id {
					b.Characters[i].Portrait = data
					break
				}
			}
		}
	}

	return b, nil
}

func readCrawlCache(f *zip.File, b *Bundle) error {
	var cc crawler.CrawlResult
	if err := readJSON(f, &cc); err != nil {
		return err
	}
	b.CrawlCache = &cc
	return nil
}

func readCharacterFile(f *zip.File, b *Bundle) error {
	var ch compose.Character
	if err := readJSON(f, &ch); err != nil {
		return err
	}
	b.Characters = append(b.Characters, ch)
	return nil
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

func writeBytes(zw *zip.Writer, name string, data []byte) error {
	w, err := zw.Create(name)
	if err != nil {
		return fmt.Errorf("create %s: %w", name, err)
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

func readBytes(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

func isCharacterFile(name string) bool {
	prefix := "characters/"
	return len(name) > len(prefix) && name[:len(prefix)] == prefix && len(name) > 5 && name[len(name)-5:] == ".json"
}

func isPortraitFile(name string) bool {
	prefix := "images/portrait_"
	return len(name) > len(prefix) && name[:len(prefix)] == prefix && strings.HasSuffix(name, ".png")
}

func portraitIDFromName(name string) (int, error) {
	base := filepath.Base(name)
	stripped := strings.TrimPrefix(base, "portrait_")
	stripped = strings.TrimSuffix(stripped, ".png")
	return strconv.Atoi(stripped)
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
