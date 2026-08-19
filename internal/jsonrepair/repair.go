// Package jsonrepair mends the mechanically broken JSON that small local
// models produce: literal newlines inside strings, trailing commas,
// single-quoted strings, strings wrapped in backslash-escaped delimiters,
// Python literals, comments, and output truncated by a max-token limit.
// Repair is best-effort — anything outside those defect
// classes passes through untouched and is left for the caller's retry path.
//
// Hand-rolled on purpose: the defect list is small and explicit, and a
// dependency was not warranted for it. If the scope ever grows past this
// scanner, a dedicated library such as github.com/kaptinlin/jsonrepair is the
// intended replacement rather than extending this by hand.
package jsonrepair

import (
	"fmt"
	"strings"
)

// Clean strips the markdown fences models wrap JSON in, and any prose before
// or after the payload. It is the shared cleaner for every LLM-JSON call site.
func Clean(content string) string {
	s := strings.TrimSpace(content)

	if rest, ok := strings.CutPrefix(s, "```"); ok {
		s = strings.TrimPrefix(rest, "json")
		if idx := strings.LastIndex(s, "```"); idx >= 0 {
			s = s[:idx]
		}
		s = strings.TrimSpace(s)
	}

	// Models often add a sentence either side of the payload; keep the
	// outermost object or array — whichever opens first, so an array of
	// objects is not cut down to its first element's braces.
	start := strings.IndexAny(s, "{[")
	if start < 0 {
		return s
	}
	closer := "}"
	if s[start] == '[' {
		closer = "]"
	}
	if end := strings.LastIndex(s, closer); end > start {
		s = s[start : end+1]
	}

	return strings.TrimSpace(s)
}

// Repair rewrites s fixing the mechanical JSON defects small models produce.
// Valid JSON passes through byte-for-byte. The result is not guaranteed to
// parse — callers must still attempt json.Unmarshal and fall back on failure.
func Repair(s string) string {
	r := &repairer{src: s}
	r.run()
	return r.out.String()
}

// repairer is a single left-to-right scan over the input. Commas are held in
// `pending` (with any following whitespace and comments skipped) until the
// next significant character shows whether they precede a closer — that is
// what removes trailing commas without lookahead.
type repairer struct {
	src     string
	out     strings.Builder
	pending string // held comma + whitespace, flushed or comma-dropped
	stack   []byte // open '{' / '[' containers, closed on truncation
	i       int
}

func (r *repairer) run() {
	for r.i < len(r.src) {
		r.step(r.src[r.i])
	}

	// Truncated output: a dangling comma is dropped, open containers closed.
	r.dropPendingComma()
	r.closeOpenContainers()
}

// step consumes at least one input byte, dispatching on its character class.
func (r *repairer) step(c byte) {
	switch {
	case c == '"' || c == '\'':
		r.flushPending()
		r.copyString(c)
	case c == '\\' && r.i+1 < len(r.src) && r.src[r.i+1] == '"':
		// A backslash outside any string is never valid JSON: the model
		// wrapped this string in \"...\" instead of "...". Drop the
		// backslash and copy the string with escaped delimiters.
		r.flushPending()
		r.i++
		r.copyEscapedDelimiterString()
	case r.atComment():
		r.skipComment()
	case c == ',':
		r.holdComma()
	case c == '}' || c == ']':
		r.closeContainer(c)
	case c == '{' || c == '[':
		r.openContainer(c)
	case c == ' ' || c == '\t' || c == '\n' || c == '\r':
		r.copyWhitespace(c)
	case isWordChar(c):
		r.flushPending()
		r.copyWord()
	default:
		r.flushPending()
		r.out.WriteByte(c)
		r.i++
	}
}

func (r *repairer) atComment() bool {
	return r.src[r.i] == '/' && r.i+1 < len(r.src) &&
		(r.src[r.i+1] == '/' || r.src[r.i+1] == '*')
}

// holdComma parks a comma in pending; a repeated comma collapses into the one
// already held.
func (r *repairer) holdComma() {
	if !strings.Contains(r.pending, ",") {
		r.pending += ","
	}
	r.i++
}

func (r *repairer) closeContainer(c byte) {
	r.dropPendingComma()
	r.out.WriteByte(c)
	if len(r.stack) > 0 {
		r.stack = r.stack[:len(r.stack)-1]
	}
	r.i++
}

func (r *repairer) openContainer(c byte) {
	r.flushPending()
	r.stack = append(r.stack, c)
	r.out.WriteByte(c)
	r.i++
}

// copyWhitespace emits whitespace, or parks it behind a held comma so the
// comma can still be dropped should a closer follow.
func (r *repairer) copyWhitespace(c byte) {
	if r.pending != "" {
		r.pending += string(c)
	} else {
		r.out.WriteByte(c)
	}
	r.i++
}

// closeOpenContainers unwinds the bracket stack after truncated output.
func (r *repairer) closeOpenContainers() {
	for j := len(r.stack) - 1; j >= 0; j-- {
		if r.stack[j] == '{' {
			r.out.WriteByte('}')
		} else {
			r.out.WriteByte(']')
		}
	}
}

func (r *repairer) flushPending() {
	r.out.WriteString(r.pending)
	r.pending = ""
}

// dropPendingComma flushes held whitespace but discards the held comma — the
// next character turned out to be a closer (or the input ended).
func (r *repairer) dropPendingComma() {
	r.out.WriteString(strings.Replace(r.pending, ",", "", 1))
	r.pending = ""
}

// copyString copies one string literal opened by quote, emitting it
// double-quoted with control characters escaped. Single-quoted input has its
// inner double quotes escaped and escaped single quotes unescaped. An
// unterminated string (truncated output) is closed at end of input.
func (r *repairer) copyString(quote byte) {
	r.out.WriteByte('"')
	r.i++ // opening quote
	for r.i < len(r.src) {
		c := r.src[r.i]
		switch {
		case c == '\\':
			if r.i+1 >= len(r.src) {
				// Truncated mid-escape: drop the dangling backslash.
				r.i++
				break
			}
			next := r.src[r.i+1]
			if quote == '\'' && next == '\'' {
				r.out.WriteByte('\'')
			} else {
				r.out.WriteByte('\\')
				r.out.WriteByte(next)
			}
			r.i += 2
		case c == quote:
			r.out.WriteByte('"')
			r.i++
			return
		case c == '"': // only reachable for single-quoted input
			r.out.WriteString(`\"`)
			r.i++
		case c < 0x20:
			r.out.WriteString(escapeControl(c))
			r.i++
		default:
			r.out.WriteByte(c)
			r.i++
		}
	}
	r.out.WriteByte('"') // unterminated: close it
}

// copyEscapedDelimiterString copies one string the model delimited with \"
// instead of " (the opening backslash is already consumed). It closes on the
// matching \" and escapes any bare inner double quote, mirroring the
// single-quoted-input path. An unterminated string is closed at end of input.
func (r *repairer) copyEscapedDelimiterString() {
	r.out.WriteByte('"')
	r.i++ // opening quote
	for r.i < len(r.src) {
		c := r.src[r.i]
		switch {
		case c == '\\' && r.i+1 < len(r.src) && r.src[r.i+1] == '"':
			r.out.WriteByte('"') // the matching \" delimiter
			r.i += 2
			return
		case c == '\\':
			if r.i+1 >= len(r.src) {
				// Truncated mid-escape: drop the dangling backslash.
				r.i++
				break
			}
			r.out.WriteByte('\\')
			r.out.WriteByte(r.src[r.i+1])
			r.i += 2
		case c == '"':
			r.out.WriteString(`\"`)
			r.i++
		case c < 0x20:
			r.out.WriteString(escapeControl(c))
			r.i++
		default:
			r.out.WriteByte(c)
			r.i++
		}
	}
	r.out.WriteByte('"') // unterminated: close it
}

func escapeControl(c byte) string {
	switch c {
	case '\n':
		return `\n`
	case '\t':
		return `\t`
	case '\r':
		return `\r`
	default:
		return fmt.Sprintf(`\u%04x`, c)
	}
}

// skipComment discards a // line comment or /* block comment. Held pending
// state survives, so a comment between a comma and a closer still allows the
// trailing comma to be dropped.
func (r *repairer) skipComment() {
	if r.src[r.i+1] == '/' {
		for r.i < len(r.src) && r.src[r.i] != '\n' {
			r.i++
		}
		return
	}
	r.i += 2
	for r.i+1 < len(r.src) && (r.src[r.i] != '*' || r.src[r.i+1] != '/') {
		r.i++
	}
	r.i = min(r.i+2, len(r.src))
}

// copyWord copies a bare identifier, translating Python literals to JSON.
func (r *repairer) copyWord() {
	start := r.i
	for r.i < len(r.src) && isWordChar(r.src[r.i]) {
		r.i++
	}
	switch word := r.src[start:r.i]; word {
	case "True":
		r.out.WriteString("true")
	case "False":
		r.out.WriteString("false")
	case "None":
		r.out.WriteString("null")
	default:
		r.out.WriteString(word)
	}
}

func isWordChar(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c == '_'
}
