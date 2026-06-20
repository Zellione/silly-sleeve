package app

import (
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/cardexport"
	"silly-sleeve/internal/lorebook"
)

// Wails event names emitted during a bulk export run.
const (
	eventExportProgress = "export:progress"
	eventExportComplete = "export:complete"
)

// ExportProgress is emitted on the "export:progress" event once per character
// as a bulk export run advances.
type ExportProgress struct {
	Index  int    `json:"index"`
	Total  int    `json:"total"`
	CharID int    `json:"charId"`
	Name   string `json:"name"`
	Status string `json:"status"` // "writing" | "done" | "error"
	Path   string `json:"path,omitempty"`
	Error  string `json:"error,omitempty"`
}

// ExportResult summarizes a completed bulk export run. It is also emitted on
// the "export:complete" event.
type ExportResult struct {
	Exported int      `json:"exported"`
	Failed   int      `json:"failed"`
	Paths    []string `json:"paths"`
}

// emit sends a Wails event to the frontend, but only when the context actually
// carries the Wails event manager. During tests the app runs on a plain
// background context, so emission is skipped rather than aborting the process
// (runtime.EventsEmit calls log.Fatalf on a non-Wails context).
func (a *App) emit(name string, data any) {
	if a.ctx == nil || a.ctx.Value("events") == nil {
		return
	}
	runtime.EventsEmit(a.ctx, name, data)
}

// ExportCharacterPNG exports a single character as a SillyTavern PNG card.
// spec is "v2" (chara chunk only) or "v3" (chara + ccv3 with embedded lorebook).
func (a *App) ExportCharacterPNG(charID int, spec string, opts cardexport.Options, folderPath string) (string, error) {
	ch, entries, ok := a.exportSnapshot(charID)
	if !ok {
		return "", charNotFound(charID)
	}
	return cardexport.ExportCharacterPNG(ch, entries, spec, opts, folderPath)
}

// ExportCharactersBulk exports several characters sequentially in the chosen
// format ("json", "png-v2", "png-v3"), emitting an "export:progress" event for
// each character and a final "export:complete" event.
func (a *App) ExportCharactersBulk(charIDs []int, format string, opts cardexport.Options, folderPath string) (ExportResult, error) {
	a.mu.Lock()
	byID := make(map[int]compose.Character, len(a.characters))
	for _, c := range a.characters {
		byID[c.ID] = c
	}
	entries := make([]lorebook.Entry, len(a.lorebookEntries))
	copy(entries, a.lorebookEntries)
	a.mu.Unlock()

	result := ExportResult{Paths: []string{}}
	total := len(charIDs)
	for i, id := range charIDs {
		ch, found := byID[id]
		if !found {
			result.Failed++
			a.emit(eventExportProgress, ExportProgress{Index: i, Total: total, CharID: id, Status: "error", Error: "character not found"})
			continue
		}

		a.emit(eventExportProgress, ExportProgress{Index: i, Total: total, CharID: id, Name: ch.Name, Status: "writing"})

		path, err := exportOne(ch, entries, format, opts, folderPath)
		if err != nil {
			result.Failed++
			a.emit(eventExportProgress, ExportProgress{Index: i, Total: total, CharID: id, Name: ch.Name, Status: "error", Error: err.Error()})
			continue
		}

		result.Exported++
		result.Paths = append(result.Paths, path)
		a.emit(eventExportProgress, ExportProgress{Index: i, Total: total, CharID: id, Name: ch.Name, Status: "done", Path: path})
	}

	a.emit(eventExportComplete, result)
	return result, nil
}

// exportSnapshot copies a character (by ID) and the lorebook out from under the
// lock for a stateless export.
func (a *App) exportSnapshot(charID int) (compose.Character, []lorebook.Entry, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	entries := make([]lorebook.Entry, len(a.lorebookEntries))
	copy(entries, a.lorebookEntries)
	for _, c := range a.characters {
		if c.ID == charID {
			return c, entries, true
		}
	}
	return compose.Character{}, entries, false
}

// exportOne writes a single character in the requested format and returns the
// written path.
func exportOne(ch compose.Character, entries []lorebook.Entry, format string, opts cardexport.Options, folderPath string) (string, error) {
	switch format {
	case "json":
		return compose.ExportSillyTavernCard(ch, folderPath)
	case "png-v2":
		return cardexport.ExportCharacterPNG(ch, entries, "v2", opts, folderPath)
	case "png-v3":
		return cardexport.ExportCharacterPNG(ch, entries, "v3", opts, folderPath)
	default:
		return "", fmt.Errorf("unknown export format %q", format)
	}
}
