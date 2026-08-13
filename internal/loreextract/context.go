package loreextract

import (
	"fmt"
	"strconv"
	"strings"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/lorebook"
)

// buildCharacterRoster renders the project's characters compactly, as
// "id · name · epithet" lines. Only identity is included: the model needs to
// know which characters exist and what to call them, not their full cards.
func buildCharacterRoster(characters []compose.Character) string {
	if len(characters) == 0 {
		return "(none)"
	}
	var b strings.Builder
	for _, c := range characters {
		name := strings.TrimSpace(c.Name)
		if name == "" {
			name = fmt.Sprintf("Character %d", c.ID)
		}
		fmt.Fprintf(&b, "%d · %s", c.ID, name)
		if e := strings.TrimSpace(c.Epithet); e != "" {
			b.WriteString(" · ")
			b.WriteString(e)
		}
		b.WriteString("\n")
	}
	return strings.TrimRight(b.String(), "\n")
}

// buildEntryIndex renders every entry as "uid · comment · keys". This is what
// lets a model link to an entry it cannot see the text of: to connect to an
// entry it reuses that entry's exact key spelling.
func buildEntryIndex(entries []lorebook.Entry) string {
	if len(entries) == 0 {
		return "(none)"
	}
	var b strings.Builder
	for _, e := range entries {
		comment := strings.TrimSpace(e.Comment)
		if comment == "" {
			comment = "(untitled)"
		}
		fmt.Fprintf(&b, "%d · %s", e.UID, comment)
		if len(e.Key) > 0 {
			fmt.Fprintf(&b, " · %s", strings.Join(e.Key, ", "))
		}
		b.WriteString("\n")
	}
	return strings.TrimRight(b.String(), "\n")
}

// buildFocusEntries renders entries in full, for the batch currently being
// analysed by the connection pass.
func buildFocusEntries(entries []lorebook.Entry) string {
	if len(entries) == 0 {
		return "(none)"
	}
	var b strings.Builder
	for _, e := range entries {
		fmt.Fprintf(&b, "uid %d · %s\n", e.UID, strings.TrimSpace(e.Comment))
		if e.Category != "" {
			fmt.Fprintf(&b, "category: %s\n", e.Category)
		}
		fmt.Fprintf(&b, "keys: %s\n", joinOrNone(e.Key))
		if len(e.KeySecondary) > 0 {
			fmt.Fprintf(&b, "secondary keys: %s\n", strings.Join(e.KeySecondary, ", "))
		}
		fmt.Fprintf(&b, "scoped to characters: %s\n", joinOrNone(e.Characters))
		fmt.Fprintf(&b, "content: %s\n\n", strings.TrimSpace(e.Content))
	}
	return strings.TrimRight(b.String(), "\n")
}

func joinOrNone(items []string) string {
	if len(items) == 0 {
		return "(none)"
	}
	return strings.Join(items, ", ")
}

// resolveCharacterRefs maps whatever the model put in a "characters" list onto
// real character IDs, returning the resolved IDs and any reference that could
// not be matched.
//
// The prompt asks for IDs, but models reason in names and will happily return
// "Alistair" — or a plausible ID for a character that does not exist. Both have
// to be caught here: Entry.Characters holds ID strings, and an unresolvable
// value would silently scope the entry to nobody.
func resolveCharacterRefs(refs []string, characters []compose.Character) (ids []string, unresolved []string) {
	byID := make(map[string]bool, len(characters))
	byName := make(map[string]string, len(characters))
	for _, c := range characters {
		id := strconv.Itoa(c.ID)
		byID[id] = true
		if name := strings.ToLower(strings.TrimSpace(c.Name)); name != "" {
			byName[name] = id
		}
	}

	seen := make(map[string]bool, len(refs))
	for _, ref := range refs {
		ref = strings.TrimSpace(ref)
		if ref == "" {
			continue
		}

		id, ok := resolveOneCharacterRef(ref, byID, byName)
		if !ok {
			unresolved = append(unresolved, ref)
			continue
		}
		if seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	return ids, unresolved
}

func resolveOneCharacterRef(ref string, byID map[string]bool, byName map[string]string) (string, bool) {
	if byID[ref] {
		return ref, true
	}
	if id, ok := byName[strings.ToLower(ref)]; ok {
		return id, true
	}
	return "", false
}
