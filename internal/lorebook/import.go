package lorebook

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
)

// ParseWorldInfo parses a SillyTavern lorebook JSON document into entries.
// It accepts three shapes, in precedence order:
//
//	1. World Info export: {"entries": {"<uid>": {entry}}}
//	2. Character book:     {"entries": [{entry}]}
//	3. Bare array:         [{entry}]
//
// Entries are returned sorted ascending by UID. Empty or unrecognized input
// yields an empty slice with no error; only malformed JSON returns an error.
func ParseWorldInfo(data []byte) ([]Entry, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, nil
	}

	var entries []Entry

	if trimmed[0] == '[' {
		if err := json.Unmarshal(trimmed, &entries); err != nil {
			return nil, fmt.Errorf("parse lorebook array: %w", err)
		}
	} else {
		var doc struct {
			Entries json.RawMessage `json:"entries"`
		}
		if err := json.Unmarshal(trimmed, &doc); err != nil {
			return nil, fmt.Errorf("parse lorebook document: %w", err)
		}
		entries = parseEntriesField(doc.Entries)
	}

	sort.SliceStable(entries, func(i, j int) bool { return entries[i].UID < entries[j].UID })
	return entries, nil
}

// parseEntriesField decodes the "entries" field, which may be a uid-keyed
// object map or an array. Unrecognized shapes yield nil.
func parseEntriesField(raw json.RawMessage) []Entry {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil
	}
	switch trimmed[0] {
	case '[':
		var arr []Entry
		if json.Unmarshal(trimmed, &arr) == nil {
			return arr
		}
	case '{':
		var m map[string]Entry
		if json.Unmarshal(trimmed, &m) == nil {
			out := make([]Entry, 0, len(m))
			for _, e := range m {
				out = append(out, e)
			}
			return out
		}
	}
	return nil
}
