package comfy

// ComfyClient is the injectable seam over a ComfyUI HTTP client. It covers the
// connectivity check and node-input discovery used to populate the UI, so that
// logic can be unit-tested with a fake instead of a real ComfyUI instance.
//
// *Client satisfies this interface.
type ComfyClient interface {
	TestConnection() error
	GetNodeInputList(nodeType, inputName string) ([]string, error)
}

// compile-time assertion that the concrete client satisfies the interface.
var _ ComfyClient = (*Client)(nil)
