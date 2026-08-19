// Command llmtest runs every real LLM interaction in the app against a live
// OpenAI-compatible endpoint and writes a format/consistency report. See
// internal/llmtest for the harness itself.
package main

import (
	"os"

	"silly-sleeve/internal/llmtest"
)

func main() {
	os.Exit(llmtest.RunCLI(os.Args[1:], os.Stdout, os.Stderr))
}
