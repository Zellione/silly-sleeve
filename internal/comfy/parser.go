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
	params := WorkflowParams{Seed: initSeedParam(seed)}

	ksID := w.findKSampler()
	if ksID == 0 {
		applyDefaultParams(&params)
		return params
	}

	extractFromKSamplerParam(w.Nodes[ksID], w, &params)
	pw, ph, ckpt := extractDimensionsAndCheckpointParam(w)
	params.Width, params.Height, params.Checkpoint = pw, ph, ckpt
	applyDefaultParams(&params)

	return params
}

func initSeedParam(seed int) int {
	if seed > 0 {
		return seed
	}
	const maxInt = 1 << 31
	return int(rand.Int63n(int64(maxInt))) + 1 //nolint:gosec
}

func applyDefaultParams(p *WorkflowParams) {
	if p.Steps <= 0 {
		p.Steps = 20
	}
	if p.CFG <= 0 {
		p.CFG = 7.0
	}
	if p.Denoise <= 0 {
		p.Denoise = 1.0
	}
	if p.Sampler == "" {
		p.Sampler = "euler"
	}
	if p.Scheduler == "" {
		p.Scheduler = "normal"
	}
}

func extractFromKSamplerParam(ks Node, w *Workflow, p *WorkflowParams) {
	for _, in := range ks.Inputs {
		switch in.Name {
		case "seed":
			p.Seed = extractSeedParam(in, p.Seed)
		case "steps":
			if s, ok := extractStepsParam(in); ok {
				p.Steps = s
			}
		case "cfg":
			if f, ok := extractCFGParam(in); ok {
				p.CFG = f
			}
		case "sampler_name":
			p.Sampler = extractSamplerNameParam(in)
		case "scheduler":
			p.Scheduler = extractSchedulerParam(in)
		case "denoise":
			if f, ok := extractDenoiseParam(in); ok {
				p.Denoise = f
			}
		case "positive":
			p.Prompt = extractPositivePromptParam(in, w)
		case "negative":
			p.NegativePrompt = extractNegativePromptParam(in, w)
		}
	}
}

func extractSeedParam(in NodeInput, fallback int) int {
	if in.Connected {
		return fallback
	}
	if s, ok := toInt(in.Value); ok && s > 0 {
		return s
	}
	return fallback
}

func extractStepsParam(in NodeInput) (int, bool) {
	return extractIntParam(in)
}

func extractCFGParam(in NodeInput) (float64, bool) {
	return extractFloatParam(in)
}

func extractDenoiseParam(in NodeInput) (float64, bool) {
	return extractFloatParam(in)
}

func extractIntParam(in NodeInput) (int, bool) {
	s, ok := toInt(in.Value)
	return s, ok && s > 0
}

func extractFloatParam(in NodeInput) (float64, bool) {
	f, ok := toFloat(in.Value)
	return f, ok && f > 0
}

func extractSamplerNameParam(in NodeInput) string {
	return extractStringParam(in)
}

func extractSchedulerParam(in NodeInput) string {
	return extractStringParam(in)
}

func extractStringParam(in NodeInput) string {
	if s, ok := in.Value.(string); ok {
		return s
	}
	return ""
}

func extractPositivePromptParam(in NodeInput, w *Workflow) string {
	if in.Connected {
		return w.findText(in.SourceID)
	}
	return ""
}

func extractNegativePromptParam(in NodeInput, w *Workflow) string {
	if in.Connected {
		return w.findText(in.SourceID)
	}
	return ""
}

func extractDimensionsAndCheckpointParam(w *Workflow) (int, int, string) {
	var width, height int
	var checkpoint string
	for _, node := range w.Nodes {
		switch node.ClassType {
		case "EmptyLatentImage":
			w, h := extractLatentDimensionsParam(node)
			if w > 0 {
				width = w
			}
			if h > 0 {
				height = h
			}
		case "CheckpointLoaderSimple", "CheckpointLoader":
			checkpoint = extractCheckpointParam(node)
		}
	}
	return width, height, checkpoint
}

func extractLatentDimensionsParam(node Node) (int, int) {
	var w, h int
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
	return w, h
}

func extractCheckpointParam(node Node) string {
	for _, in := range node.Inputs {
		if in.Name == "ckpt_name" {
			if s, ok := in.Value.(string); ok {
				return s
			}
		}
	}
	return ""
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
