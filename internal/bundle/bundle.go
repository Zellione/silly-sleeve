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
	"silly-sleeve/internal/loreextract"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
)

const manifestFile = "manifest.json"

// maxBundleEntryBytes caps the uncompressed size of any single entry read from
// a .slv bundle, guarding against decompression bombs in untrusted bundles.
const (
	// maxBundleEntryBytes is the maximum size of a single entry in the bundle.
	// 64 MiB per entry is large enough for character images, portraits, and JSON data.
	maxBundleEntryBytes = 64 << 20

	// maxBundleEntries is the maximum number of entries allowed in a bundle.
	// Protects against zip bombs with millions of small entries.
	// Typical bundles have <100 entries (manifest, lorebook, a few characters with portraits).
	maxBundleEntries = 10000

	// maxBundleCumulativeBytes is the maximum cumulative uncompressed size across all entries.
	// 512 MiB total is 8x the single-entry limit, providing headroom for legitimate multi-character bundles
	// while blocking aggregated DoS attacks.
	maxBundleCumulativeBytes = 512 << 20
) // 64 MiB

// Bundle holds all data to be serialized into a .slv file.
type Bundle struct {
	Manifest   project.ProjectManifest `json:"manifest"`
	Characters []compose.Character     `json:"characters"`
	Lorebook   []lorebook.Entry        `json:"lorebook"`
	Prompts    prompts.TemplateSet     `json:"prompts"`
	CrawlCache *crawler.CrawlResult    `json:"crawlCache"`
	CrawlSet   *crawler.CrawlSet       `json:"crawlSet"`
	// Extraction is the in-progress lorebook review: staged sources, candidates
	// and suggestions. Optional, like the crawl entries — bundles written before
	// it existed simply have none.
	Extraction *loreextract.State `json:"extraction"`
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

	if err := writeManifestEntry(zw, manifest); err != nil {
		return err
	}
	if err := writeProjectImageEntry(zw, projectImage); err != nil {
		return err
	}
	if err := writeCharacterEntries(zw, b.Characters); err != nil {
		return err
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
	if b.CrawlSet != nil {
		if err := writeJSON(zw, "crawl_set.json", b.CrawlSet); err != nil {
			return err
		}
	}
	if b.Extraction != nil && !b.Extraction.Empty() {
		if err := writeJSON(zw, "extraction.json", b.Extraction); err != nil {
			return err
		}
	}

	return nil
}

func writeManifestEntry(zw *zip.Writer, manifest project.ProjectManifest) error {
	return writeJSON(zw, manifestFile, manifest)
}

func writeProjectImageEntry(zw *zip.Writer, data []byte) error {
	if len(data) > 0 {
		if err := writeBytes(zw, "images/project.png", data); err != nil {
			return fmt.Errorf("write project image: %w", err)
		}
	}
	return nil
}

func writeCharacterEntries(zw *zip.Writer, characters []compose.Character) error {
	for i, ch := range characters {
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
	return nil
}

// ReadBundle reads a .slv zip file and returns the project bundle.
func ReadBundle(filePath string) (Bundle, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return Bundle{}, fmt.Errorf("open bundle: %w", err)
	}
	defer r.Close()

	// Check entry count early to reject zip bombs
	if len(r.File) > maxBundleEntries {
		return Bundle{}, fmt.Errorf("bundle contains %d entries, exceeds maximum of %d", len(r.File), maxBundleEntries)
	}

	b := Bundle{}
	var cumulativeBytes int64

	foundManifest, err := readManifestAndBundleMetadata(r, &b, &cumulativeBytes)
	if err != nil {
		return Bundle{}, err
	}
	if !foundManifest {
		return Bundle{}, fmt.Errorf("no manifest.json in bundle")
	}

	if err := readImageFilesFromBundle(r, &b, &cumulativeBytes); err != nil {
		return Bundle{}, err
	}

	if b.CrawlSet == nil && b.CrawlCache != nil {
		b.CrawlSet = &crawler.CrawlSet{
			RootURL: b.CrawlCache.URL,
			Results: []crawler.CrawlResult{*b.CrawlCache},
		}
	}

	return b, nil
}

func readManifestAndBundleMetadata(r *zip.ReadCloser, b *Bundle, cumulativeBytes *int64) (bool, error) {
	fileReaders := map[string]func(*zip.File) error{
		manifestFile:       func(f *zip.File) error { return readJSON(f, &b.Manifest, cumulativeBytes) },
		"prompts.json":     func(f *zip.File) error { return readJSON(f, &b.Prompts, cumulativeBytes) },
		"lorebook.json":    func(f *zip.File) error { return readJSON(f, &b.Lorebook, cumulativeBytes) },
		"crawl_cache.json": func(f *zip.File) error { return readCrawlCache(f, b, cumulativeBytes) },
		"crawl_set.json":   func(f *zip.File) error { return readCrawlSet(f, b, cumulativeBytes) },
		"extraction.json":  func(f *zip.File) error { return readExtraction(f, b, cumulativeBytes) },
	}

	foundManifest := false
	for _, f := range r.File {
		if !safeEntryName(f.Name) {
			continue
		}
		if reader, ok := fileReaders[f.Name]; ok {
			if err := reader(f); err != nil {
				return false, fmt.Errorf("read %s: %w", f.Name, err)
			}
			if f.Name == manifestFile {
				foundManifest = true
			}
		} else if isCharacterFile(f.Name) {
			if err := readCharacterFile(f, b, cumulativeBytes); err != nil {
				return false, fmt.Errorf("read character %s: %w", f.Name, err)
			}
		}
	}

	return foundManifest, nil
}

func readImageFilesFromBundle(r *zip.ReadCloser, b *Bundle, cumulativeBytes *int64) error {
	for _, f := range r.File {
		if !safeEntryName(f.Name) {
			continue
		}
		if f.Name == "images/project.png" {
			data, err := readBytes(f, cumulativeBytes)
			if err != nil {
				return fmt.Errorf("read project image: %w", err)
			}
			b.Manifest.ProjectImage = data
		} else if isPortraitFile(f.Name) {
			id, err := portraitIDFromName(f.Name)
			if err != nil {
				continue
			}
			data, err := readBytes(f, cumulativeBytes)
			if err != nil {
				return fmt.Errorf("read portrait %d: %w", id, err)
			}
			assignPortraitToCharacter(b.Characters, id, data)
		}
	}
	return nil
}

func assignPortraitToCharacter(characters []compose.Character, id int, data []byte) {
	for i := range characters {
		if characters[i].ID == id {
			characters[i].Portrait = data
			break
		}
	}
}

func readCrawlCache(f *zip.File, b *Bundle, cumulativeBytes *int64) error {
	var cc crawler.CrawlResult
	if err := readJSON(f, &cc, cumulativeBytes); err != nil {
		return err
	}
	b.CrawlCache = &cc
	return nil
}

func readCrawlSet(f *zip.File, b *Bundle, cumulativeBytes *int64) error {
	var cs crawler.CrawlSet
	if err := readJSON(f, &cs, cumulativeBytes); err != nil {
		return err
	}
	b.CrawlSet = &cs
	return nil
}

func readExtraction(f *zip.File, b *Bundle, cumulativeBytes *int64) error {
	var st loreextract.State
	if err := readJSON(f, &st, cumulativeBytes); err != nil {
		return err
	}
	b.Extraction = &st
	return nil
}

func readCharacterFile(f *zip.File, b *Bundle, cumulativeBytes *int64) error {
	var ch compose.Character
	if err := readJSON(f, &ch, cumulativeBytes); err != nil {
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

func readJSON(f *zip.File, v any, cumulativeBytes *int64) error {
	b, err := readBytes(f, cumulativeBytes)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func readBytes(f *zip.File, cumulativeBytes *int64) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return readAllLimited(rc, maxBundleEntryBytes, cumulativeBytes)
}

// readAllLimited reads from r but fails if the content exceeds limit bytes,
// preventing a small compressed entry from expanding to exhaust memory.
func readAllLimited(r io.Reader, limit int64, cumulativeBytes *int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("bundle entry exceeds %d byte limit", limit)
	}
	if cumulativeBytes != nil {
		*cumulativeBytes += int64(len(data))
		if *cumulativeBytes > maxBundleCumulativeBytes {
			return nil, fmt.Errorf("bundle cumulative size exceeds %d byte limit", maxBundleCumulativeBytes)
		}
	}
	return data, nil
}

// safeEntryName rejects zip entry names that attempt path traversal or use
// absolute paths. Entries here are read into memory rather than extracted to
// disk, but this is defense-in-depth against malicious bundles.
func safeEntryName(name string) bool {
	if name == "" || strings.ContainsRune(name, '\\') || filepath.IsAbs(name) {
		return false
	}
	clean := filepath.ToSlash(filepath.Clean(name))
	return clean != ".." && !strings.HasPrefix(clean, "../") && !strings.HasPrefix(clean, "/")
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
