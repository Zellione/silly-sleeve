package comfy

import "encoding/json"

// WorkflowParams holds extracted parameters from a ComfyUI workflow.
type WorkflowParams struct {
	Prompt         string  `json:"prompt"`
	NegativePrompt string  `json:"negativePrompt"`
	Seed           int     `json:"seed"`
	Steps          int     `json:"steps"`
	CFG            float64 `json:"cfg"`
	Sampler        string  `json:"sampler"`
	Scheduler      string  `json:"scheduler"`
	Width          int     `json:"width"`
	Height         int     `json:"height"`
	Checkpoint     string  `json:"checkpoint"`
	Denoise        float64 `json:"denoise"`
}

// ComfyWorkflow holds an imported ComfyUI workflow JSON and its extracted params.
type ComfyWorkflow struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	JSONData json.RawMessage `json:"jsonData"`
	Params   WorkflowParams  `json:"params"`
}

// Node represents a single node in a ComfyUI workflow graph.
type Node struct {
	ID        int              `json:"id"`
	ClassType string           `json:"class_type"`
	Inputs    []NodeInput      `json:"inputs"`
	Outputs   []NodeOutput     `json:"outputs"`
	Title     string           `json:"_meta_title"`
}

// NodeInput represents a single input connection or value.
type NodeInput struct {
	Name      string
	Value     any
	Connected bool
	SourceID  int
	SourceSlot int
}

// NodeOutput represents an output slot.
type NodeOutput struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Links []int `json:"links"`
}

// Workflow is the top-level structure of a ComfyUI workflow JSON.
type Workflow struct {
	LastNodeID int            `json:"last_node_id"`
	Nodes      map[int]Node
	Raw        json.RawMessage
}

// QueuedRequest is the body sent to POST /prompt.
type QueuedRequest struct {
	ClientID string           `json:"client_id"`
	Prompt   json.RawMessage  `json:"prompt"`
}

// QueuedResponse is returned from POST /prompt.
type QueuedResponse struct {
	PromptID   string           `json:"prompt_id"`
	Number     int              `json:"number"`
	NodeErrors map[string]any   `json:"node_errors"`
}

// HistoryEntry represents a single execution in ComfyUI history.
type HistoryEntry struct {
	Outputs map[int]struct {
		Images []struct {
			Filename  string `json:"filename"`
			Subfolder string `json:"subfolder"`
			Type      string `json:"type"`
		} `json:"images"`
	} `json:"outputs"`
}

// HistoryResponse maps prompt IDs to their execution results.
type HistoryResponse map[string]HistoryEntry

// SystemStats holds the response from GET /system_stats.
type SystemStats struct {
	System struct {
		OS            string `json:"os"`
		PythonVersion string `json:"python_version"`
		ComfyGitHash  string `json:"comfyui_version"`
	} `json:"system"`
	Devices []struct {
		Name   string `json:"name"`
		Type   string `json:"type"`
		VRAM   int64  `json:"vram_total"`
	} `json:"devices"`
}

// StatusExecInfo holds queue status details from ComfyUI WebSocket.
type StatusExecInfo struct {
	QueueRemaining int `json:"queue_remaining"`
}

// WSStatusMsg is received from ComfyUI WebSocket for status updates.
type WSStatusMsg struct {
	Type string       `json:"type"`
	Data WSStatusData `json:"data"`
}

// WSStatusData contains the nested status payload.
type WSStatusData struct {
	Status WSStatusInfo `json:"status"`
}

// WSStatusInfo wraps the execution info.
type WSStatusInfo struct {
	ExecInfo StatusExecInfo `json:"exec_info"`
}

// WSProgressMsg reports per-node progress during generation.
type WSProgressMsg struct {
	Type  string `json:"type"`
	Data  struct {
		Value int `json:"value"`
		Max   int `json:"max"`
	} `json:"data"`
}

// WSExecutingMsg indicates which node is currently executing (null = done).
type WSExecutingMsg struct {
	Type string  `json:"type"`
	Data struct {
		Node     *string `json:"node"`
		PromptID string  `json:"prompt_id"`
	} `json:"data"`
}

// ExecutedOutputData holds the output images from a completed node.
type ExecutedOutputData struct {
	Images []CompletedImage `json:"images"`
}

// ExecutedMsg holds the output images from a completed node.
type ExecutedMsg struct {
	Type string         `json:"type"`
	Data ExecutedMsgData `json:"data"`
}

// ExecutedMsgData wraps the node and output data.
type ExecutedMsgData struct {
	Node   string             `json:"node"`
	Output ExecutedOutputData `json:"output"`
}

// ProgressEvent is emitted to the frontend as a Wails event.
type ProgressEvent struct {
	PromptID       string `json:"promptId"`
	Progress       int    `json:"progress"`
	Max            int    `json:"max"`
	Node           string `json:"node"`
	QueueRemaining int    `json:"queueRemaining"`
}

// CompletedEvent is emitted when a full generation finishes.
type CompletedEvent struct {
	PromptID string           `json:"promptId"`
	Images   []CompletedImage `json:"images"`
}

// CompletedImage holds info about a generated image.
type CompletedImage struct {
	Filename  string `json:"filename"`
	Subfolder string `json:"subfolder"`
	Type      string `json:"type"`
}

// ErrorEvent is emitted when a generation fails.
type ErrorEvent struct {
	PromptID string `json:"promptId"`
	Error    string `json:"error"`
}
