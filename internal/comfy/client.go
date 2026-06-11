package comfy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const httpErrorFormat = "HTTP %d: %s"

const (
	// maxResponseBytes caps successful response bodies (images, object_info JSON)
	// read from a potentially untrusted ComfyUI server, guarding against memory exhaustion.
	maxResponseBytes = 256 << 20 // 256 MiB
	// maxErrorBodyBytes caps the body read when surfacing an HTTP error response.
	maxErrorBodyBytes = 64 << 10 // 64 KiB
)

// Client communicates with a ComfyUI instance via its REST API.
type Client struct {
	BaseURL string
	Token   *string
	HTTP    *http.Client
}

// NewClient creates a ComfyUI API client.
func NewClient(baseURL string, token *string) *Client {
	return &Client{
		BaseURL: baseURL,
		Token:   token,
		HTTP: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SystemStats fetches system information from ComfyUI.
func (c *Client) SystemStats() (*SystemStats, error) {
	var stats SystemStats
	if err := c.doGet("/system_stats", &stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

// QueuePrompt sends a workflow to ComfyUI's prompt queue.
// The workflow should be the raw workflow JSON map.
func (c *Client) QueuePrompt(clientID string, workflow json.RawMessage) (*QueuedResponse, error) {
	req := QueuedRequest{
		ClientID: clientID,
		Prompt:   workflow,
	}
	var resp QueuedResponse
	if err := c.doPost("/prompt", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// History retrieves execution history for a prompt ID.
func (c *Client) History(promptID string) (*HistoryEntry, error) {
	hist := make(HistoryResponse)
	if err := c.doGet(fmt.Sprintf("/history/%s", promptID), &hist); err != nil {
		return nil, err
	}
	if entry, ok := hist[promptID]; ok {
		return &entry, nil
	}
	return nil, fmt.Errorf("no history for prompt %s", promptID)
}

// GetImage fetches a generated image by filename, subfolder, and type.
func (c *Client) GetImage(filename, subfolder, folderType string) ([]byte, error) {
	params := url.Values{}
	params.Set("filename", filename)
	if subfolder != "" {
		params.Set("subfolder", subfolder)
	}
	if folderType != "" {
		params.Set("type", folderType)
	}
	path := "/view?" + params.Encode()
	return c.doGetBytes(path)
}

// TestConnection verifies the ComfyUI instance is reachable.
func (c *Client) TestConnection() error {
	_, err := c.SystemStats()
	return err
}

// GetObjectInfo fetches node type definitions from ComfyUI.
func (c *Client) GetObjectInfo(nodeType string) (*ObjectInfoResponse, error) {
	var info ObjectInfoResponse
	if err := c.doGet("/object_info/"+nodeType, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

// GetNodeInputList returns the list of possible values for a specific node input.
func (c *Client) GetNodeInputList(nodeType, inputName string) ([]string, error) {
	info, err := c.GetObjectInfo(nodeType)
	if err != nil {
		return nil, err
	}
	var nodeInfo ObjectInfoNode
	var ok bool
	if nodeInfo, ok = (*info)[nodeType]; !ok {
		return nil, fmt.Errorf("node type %q not found in object_info", nodeType)
	}
	raw, exists := nodeInfo.Input.Required[inputName]
	if !exists {
		return nil, fmt.Errorf("input %q not found in node %q", inputName, nodeType)
	}
	return ExtractInputValues(raw)
}

func (c *Client) fullURL(path string) string {
	base := c.BaseURL
	if len(base) > 0 && base[len(base)-1] == '/' {
		base = base[:len(base)-1]
	}
	return base + path
}

// validateBaseURL rejects ComfyUI base URLs with non-http(s) schemes (e.g.
// file://) or no host, before any request is made.
func (c *Client) validateBaseURL() error {
	u, err := url.Parse(c.BaseURL)
	if err != nil {
		return fmt.Errorf("invalid ComfyUI URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("ComfyUI URL must use http or https, got %q", u.Scheme)
	}
	if u.Host == "" {
		return fmt.Errorf("ComfyUI URL must include a host")
	}
	return nil
}

func (c *Client) doGet(path string, dest any) error {
	if err := c.validateBaseURL(); err != nil {
		return err
	}
	u := c.fullURL(path)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	c.setAuth(req)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes))
		return fmt.Errorf(httpErrorFormat, resp.StatusCode, string(body))
	}
	if dest != nil {
		return json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(dest)
	}
	return nil
}

func (c *Client) doPost(path string, body any, dest any) error {
	if err := c.validateBaseURL(); err != nil {
		return err
	}
	u := c.fullURL(path)
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, u, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes))
		return fmt.Errorf(httpErrorFormat, resp.StatusCode, string(respBody))
	}
	if dest != nil {
		return json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(dest)
	}
	return nil
}

func (c *Client) doGetBytes(path string) ([]byte, error) {
	if err := c.validateBaseURL(); err != nil {
		return nil, err
	}
	u := c.fullURL(path)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes))
		return nil, fmt.Errorf(httpErrorFormat, resp.StatusCode, string(body))
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
}

func (c *Client) setAuth(req *http.Request) {
	if c.Token != nil && *c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+*c.Token)
	}
}
