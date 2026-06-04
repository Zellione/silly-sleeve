package lorebook

import (
	"encoding/json"
	"fmt"
	"os"
)

// Entry mirrors the SillyTavern world_info entry spec.
type Entry struct {
	UID              int      `json:"uid"`
	Comment          string   `json:"comment"`
	Key              []string `json:"key"`
	KeySecondary     []string `json:"keysecondary"`
	Content          string   `json:"content"`
	Constant         bool     `json:"constant"`
	Selective        bool     `json:"selective"`
	SelectiveLogic   int      `json:"selectiveLogic"`
	AddMemo          bool     `json:"addMemo"`
	Order            int      `json:"order"`
	Position         int      `json:"position"`
	Disable          bool     `json:"disable"`
	Probability      int      `json:"probability"`
	UseProbability   bool     `json:"useProbability"`
	Depth            int      `json:"depth"`
	Sticky           int      `json:"sticky"`
	Vectorized       bool     `json:"vectorized"`
	IgnoreBudget     bool     `json:"ignoreBudget"`
	ExcludeRecursion bool     `json:"excludeRecursion"`
	PreventRecursion bool     `json:"preventRecursion"`
	Characters       []string `json:"characters"`
}

// NewEntry creates a new lorebook entry with sensible defaults.
func NewEntry(uid int) Entry {
	return Entry{
		UID:              uid,
		Comment:          "New entry",
		Key:              []string{},
		KeySecondary:     []string{},
		Content:          "",
		AddMemo:          true,
		Order:            100,
		Position:         0,
		Probability:      100,
		UseProbability:   true,
		Depth:            4,
		Characters:       []string{},
	}
}

// NextUID returns the next available UID from a list of entries.
func NextUID(entries []Entry) int {
	max := -1
	for _, e := range entries {
		if e.UID > max {
			max = e.UID
		}
	}
	return max + 1
}

// ExportWorldInfo writes entries as a SillyTavern-compatible world_info JSON file.
func ExportWorldInfo(entries []Entry, filePath string) error {
	m := make(map[string]Entry)
	for _, e := range entries {
		m[fmt.Sprintf("%d", e.UID)] = e
	}
	wi := map[string]any{
		"entries": m,
	}

	data, err := json.MarshalIndent(wi, "", "  ")
	if err != nil {
		return fmt.Errorf("encode world_info: %w", err)
	}
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return fmt.Errorf("write world_info: %w", err)
	}
	return nil
}
