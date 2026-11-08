package comfy

// EmitFunc pushes a backend→UI event. The server layer wires it to the SSE
// hub; a nil emitter (unit tests) makes emitEvent a no-op.
type EmitFunc func(name string, data any)

// emitEvent sends a backend→UI event through the emitter.
func emitEvent(emit EmitFunc, name string, data any) {
	if emit == nil {
		return
	}
	emit(name, data)
}
