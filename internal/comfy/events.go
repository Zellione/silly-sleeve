package comfy

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// emitEvent sends a Wails event to the frontend.
// When the context is not a valid Wails application context (e.g. in tests),
// the call is silently ignored.
func emitEvent(ctx context.Context, name string, data any) {
	if ctx == nil {
		return
	}
	runtime.EventsEmit(ctx, name, data)
}
