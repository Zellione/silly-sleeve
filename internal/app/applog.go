package app

import (
	"fmt"
	"io"
	"os"
)

// logOut is where operational log lines go. A variable so tests can capture it.
var logOut io.Writer = os.Stdout

// debugEnabled turns debugf on. Set SILLY_SLEEVE_DEBUG=1 (any non-empty value)
// before launching the app to see debug output on the application console.
var debugEnabled = os.Getenv("SILLY_SLEEVE_DEBUG") != ""

// logf records an operational failure to the application console. Use it where
// an error is also returned to the frontend: the console line survives after
// the UI has moved on and carries the full detail.
func logf(format string, args ...any) {
	fmt.Fprintf(logOut, format+"\n", args...)
}

// debugf records diagnostic detail (request parameters, response sizes) that
// would be noise in normal operation. Gated by SILLY_SLEEVE_DEBUG.
func debugf(format string, args ...any) {
	if !debugEnabled {
		return
	}
	fmt.Fprintf(logOut, "[debug] "+format+"\n", args...)
}
