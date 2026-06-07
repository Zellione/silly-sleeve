package comfy

import (
	"encoding/json"
	"fmt"
	"math/rand"
)

// ParseWorkflow decodes a raw ComfyUI workflow JSON and extracts parameters.
func ParseWorkflow(raw json.RawMessage) (*Workflow, error) {
	w := &Workflow{
		Raw:   raw,
		Nodes: make(map[int]Node),
	}

	var wrapper struct {
		LastNodeID int                      `json:"last_node_id"`
		Nodes      map[string]json.RawMessage `json:"nodes"`
	}
	if err := json.Unmarshal(raw, &wrapper); err != nil {
		return nil, fmt.Errorf("unmarshal workflow: %w", err)
	}

	for _, rawNode := range wrapper.Nodes {
		var nodeRaw struct {
			ID            int              `json:"id"`
			ClassType     string           `json:"class_type"`
			Type          string           `json:"type"`
			Title         string           `json:"_meta_title"`
			Inputs        []json.RawMessage `json:"inputs"`
			Outputs       []json.RawMessage `json:"outputs"`
			WidgetsValues []any            `json:"widgets_values"`
		}
		if err := json.Unmarshal(rawNode, &nodeRaw); err != nil {
			continue
		}

		classType := nodeRaw.ClassType
		if classType == "" {
			classType = nodeRaw.Type
		}

		if classType == "" {
			continue
		}

		node := Node{
			ID:        nodeRaw.ID,
			ClassType: classType,
			Title:     nodeRaw.Title,
		}

		for _, rawInput := range nodeRaw.Inputs {
			ni := parseInput(rawInput)
			node.Inputs = append(node.Inputs, ni)
		}

		for _, rawOutput := range nodeRaw.Outputs {
			var out struct {
				Name  string `json:"name"`
				Type  string `json:"type"`
				Links []int  `json:"links"`
			}
			if err := json.Unmarshal(rawOutput, &out); err != nil {
				continue
			}
			node.Outputs = append(node.Outputs, NodeOutput{
				Name:  out.Name,
				Type:  out.Type,
				Links: out.Links,
			})
		}

		w.Nodes[node.ID] = node
	}

	w.LastNodeID = wrapper.LastNodeID

	return w, nil
}

func parseInput(raw json.RawMessage) NodeInput {
	ni := NodeInput{}

	var asObj struct {
		Name      string `json:"name"`
		Type      string `json:"type"`
		Value     any    `json:"value"`
		Link      *int   `json:"link"`
	}
	if err := json.Unmarshal(raw, &asObj); err == nil {
		ni.Name = asObj.Name
		if asObj.Link != nil {
			ni.Connected = true
			ni.Value = asObj.Link
		} else if asObj.Value != nil {
			ni.Value = asObj.Value
		}
	}

	if arr, ok := asObj.Value.([]any); ok && len(arr) >= 2 {
		if srcID, ok2 := toInt(arr[0]); ok2 {
			ni.Connected = true
			ni.SourceID = srcID
			if srcSlot, ok3 := toInt(arr[1]); ok3 {
				ni.SourceSlot = srcSlot
			}
		}
	}

	return ni
}

// ExtractParams traverses a parsed workflow to extract generation parameters.
func (w *Workflow) ExtractParams(seed int) WorkflowParams {
	params := WorkflowParams{}

	if seed <= 0 {
		const maxInt = 1 << 31
		seed = int(rand.Int63n(int64(maxInt))) + 1 //nolint:gosec
	}
	params.Seed = seed

	ksID := w.findKSampler()
	if ksID == 0 {
		params.Steps = 20
		params.CFG = 7.0
		params.Denoise = 1.0
		params.Sampler = "euler"
		params.Scheduler = "normal"
		return params
	}

	ks := w.Nodes[ksID]

	for _, in := range ks.Inputs {
		switch in.Name {
		case "seed":
			if in.Connected {
				params.Seed = seed
			} else if s, ok := toInt(in.Value); ok && s > 0 {
				params.Seed = s
			}
		case "steps":
			if s, ok := toInt(in.Value); ok && s > 0 {
				params.Steps = s
			}
		case "cfg":
			if f, ok := toFloat(in.Value); ok && f > 0 {
				params.CFG = f
			}
		case "sampler_name":
			if s, ok := in.Value.(string); ok {
				params.Sampler = s
			}
		case "scheduler":
			if s, ok := in.Value.(string); ok {
				params.Scheduler = s
			}
		case "denoise":
			if f, ok := toFloat(in.Value); ok && f > 0 {
				params.Denoise = f
			}
		case "positive":
			if in.Connected {
				params.Prompt = w.findText(in.SourceID)
			}
		case "negative":
			if in.Connected {
				params.NegativePrompt = w.findText(in.SourceID)
			}
		}
	}

	if params.Steps <= 0 {
		params.Steps = 20
	}
	if params.CFG <= 0 {
		params.CFG = 7.0
	}
	if params.Denoise <= 0 {
		params.Denoise = 1.0
	}
	if params.Sampler == "" {
		params.Sampler = "euler"
	}
	if params.Scheduler == "" {
		params.Scheduler = "normal"
	}

	for _, node := range w.Nodes {
		switch node.ClassType {
		case "EmptyLatentImage":
			w := 0
			h := 0
			for _, in := range node.Inputs {
				if in.Name == "width" {
					if v, ok := toInt(in.Value); ok {
						w = v
					}
				}
				if in.Name == "height" {
					if v, ok := toInt(in.Value); ok {
						h = v
					}
				}
			}
			if w > 0 {
				params.Width = w
			}
			if h > 0 {
				params.Height = h
			}
		case "CheckpointLoaderSimple", "CheckpointLoader":
			for _, in := range node.Inputs {
				if in.Name == "ckpt_name" {
					if s, ok := in.Value.(string); ok {
						params.Checkpoint = s
					}
				}
			}
		}
	}

	return params
}

func (w *Workflow) findKSampler() int {
	for _, node := range w.Nodes {
		switch node.ClassType {
		case "KSampler", "KSamplerAdvanced":
			return node.ID
		}
	}
	return 0
}

func (w *Workflow) findText(sourceID int) string {
	node, ok := w.Nodes[sourceID]
	if !ok {
		return ""
	}
	if node.ClassType != "CLIPTextEncode" && node.ClassType != "CLIPTextEncodeSDXL" {
		return ""
	}
	for _, in := range node.Inputs {
		if in.Name == "text" {
			if s, ok := in.Value.(string); ok {
				return s
			}
		}
	}
	return ""
}

func toInt(v any) (int, bool) {
	switch x := v.(type) {
	case float64:
		return int(x), true
	case int:
		return x, true
	case json.Number:
		n, err := x.Int64()
		if err != nil {
			return 0, false
		}
		return int(n), true
	}
	return 0, false
}

func toFloat(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case int:
		return float64(x), true
	case json.Number:
		f, err := x.Float64()
		if err != nil {
			return 0, false
		}
		return f, true
	}
	return 0, false
}
