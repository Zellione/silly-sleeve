package comfy

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// emitEvent sends a Wails event to the frontend.
// This is a no-op in headless/test environments where the Wails runtime is not available.
func emitEvent(ctx context.Context, name string, data any) {
	if ctx == nil {
		return
	}
	runtime.EventsEmit(ctx, name, data)
}
