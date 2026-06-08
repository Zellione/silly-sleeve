package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/comfy"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
	"silly-sleeve/internal/bundle"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/settings"
)

// App struct
type App struct {
	ctx             context.Context
	settings        settings.Settings
	mu              sync.Mutex
	cachedCrawl     *crawler.CrawlResult
	characters      []compose.Character
	activeCharID    int
	projectDir      string
	lorebookEntries []lorebook.Entry
	projectImage    []byte
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	s, err := settings.Load()
	if err != nil {
		fmt.Println("settings load error:", err)
		s = settings.Settings{Endpoints: []settings.LLMEndpoint{}}
	}
	a.settings = s

	c, err := crawler.LoadCache()
	if err != nil {
		fmt.Println("cache load error:", err)
	}
	if c != nil {
		a.mu.Lock()
		a.cachedCrawl = c
		a.mu.Unlock()
	}

	a.characters = []compose.Character{compose.NewCharacter(1)}
	a.activeCharID = 1
}

// GetSettings returns the current settings.
func (a *App) GetSettings() settings.Settings {
	return a.settings
}

// SaveSettings persists settings to disk.
func (a *App) SaveSettings(s settings.Settings) error {
	if err := settings.Save(s); err != nil {
		return err
	}
	a.settings = s
	return nil
}

// TestLLMEndpoint verifies connectivity to an LLM endpoint.
func (a *App) TestLLMEndpoint(ep settings.LLMEndpoint) llm.TestResult {
	return llm.TestEndpoint(llm.LLMEndpoint{
		ID:           ep.ID,
		Name:         ep.Name,
		URL:          ep.URL,
		Model:        ep.Model,
		Key:          ep.Key,
		ContextSize:  ep.ContextSize,
		Temperature:  ep.Temperature,
		SystemPrompt: ep.SystemPrompt,
	})
}

// GetComfyConfig returns the ComfyUI connection settings.
func (a *App) GetComfyConfig() settings.ComfyConfig {
	return a.settings.Comfy
}

// ImportComfyWorkflow reads a workflow JSON file, parses it, and stores it in settings.
func (a *App) ImportComfyWorkflow(filePath string) (comfy.ComfyWorkflow, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return comfy.ComfyWorkflow{}, fmt.Errorf("read workflow file: %w", err)
	}

	wf, err := comfy.ParseWorkflow(data)
	if err != nil {
		return comfy.ComfyWorkflow{}, fmt.Errorf("parse workflow: %w", err)
	}

	params := wf.ExtractParams(0)

	baseName := filePath
	if idx := strings.LastIndexByte(baseName, '/'); idx >= 0 {
		baseName = baseName[idx+1:]
	}
	if idx := strings.LastIndexByte(baseName, '.'); idx >= 0 {
		baseName = baseName[:idx]
	}

	cw := comfy.ComfyWorkflow{
		ID:       fmt.Sprintf("wf-%d", len(a.settings.Comfy.Workflows)+1),
		Name:     baseName,
		JSONData: data,
		Params:   params,
	}

	a.settings.Comfy.Workflows = append(a.settings.Comfy.Workflows, cw)
	if err := settings.Save(a.settings); err != nil {
		return comfy.ComfyWorkflow{}, fmt.Errorf("save settings: %w", err)
	}

	return cw, nil
}

// GetComfyWorkflows returns all saved ComfyUI workflows.
func (a *App) GetComfyWorkflows() []comfy.ComfyWorkflow {
	return a.settings.Comfy.Workflows
}

// DeleteComfyWorkflow removes a workflow by ID.
func (a *App) DeleteComfyWorkflow(id string) error {
	filtered := make([]comfy.ComfyWorkflow, 0, len(a.settings.Comfy.Workflows))
	for _, wf := range a.settings.Comfy.Workflows {
		if wf.ID != id {
			filtered = append(filtered, wf)
		}
	}
	a.settings.Comfy.Workflows = filtered
	if a.settings.Comfy.DefaultWorkflow == id {
		a.settings.Comfy.DefaultWorkflow = ""
	}
	return settings.Save(a.settings)
}

// TestComfyUIEndpoint verifies connectivity to a ComfyUI instance.
func (a *App) TestComfyUIEndpoint(url, token string) llm.TestResult {
	var t *string
	if token != "" {
		t = &token
	}
	client := comfy.NewClient(url, t)
	if err := client.TestConnection(); err != nil {
		return llm.TestResult{
			Ok:    false,
			Error: err.Error(),
		}
	}
		return llm.TestResult{
		Ok:        true,
	}
}

// GetDefaultPromptTemplates returns the built-in factory default templates.
func (a *App) GetDefaultPromptTemplates() prompts.TemplateSet {
	return prompts.Defaults()
}

// GetPromptTemplates returns the current prompt templates from settings.
func (a *App) GetPromptTemplates() prompts.TemplateSet {
	if len(a.settings.PromptTemplates.FieldPrompts) == 0 {
		return prompts.Defaults()
	}
	return a.settings.PromptTemplates
}

// SavePromptTemplates persists prompt templates to settings.
func (a *App) SavePromptTemplates(t prompts.TemplateSet) error {
	a.settings.PromptTemplates = t
	return settings.Save(a.settings)
}

// GeneratePortrait starts 4 ComfyUI generation jobs with seed offsets and returns the images.
func (a *App) GeneratePortrait(params comfy.GenerationParams) ([]comfy.CompletedImage, error) {
	return a.generateVariants(params, 4)
}

// GenerateProjectImage starts 3 ComfyUI generation jobs with seed offsets and returns the images.
func (a *App) GenerateProjectImage(params comfy.GenerationParams) ([]comfy.CompletedImage, error) {
	return a.generateVariants(params, 3)
}

func (a *App) generateVariants(params comfy.GenerationParams, count int) ([]comfy.CompletedImage, error) {
	var t *string
	if a.settings.Comfy.AuthToken != nil {
		t = a.settings.Comfy.AuthToken
	}

	var allImages []comfy.CompletedImage
	for i := 0; i < count; i++ {
		variantParams := params
		variantParams.Seed = params.Seed + i

		g := comfy.NewGenerator(a.ctx, a.settings.Comfy.URL, t)
		if err := g.Run(variantParams, nil); err != nil {
			return nil, fmt.Errorf("variant %d: %w", i+1, err)
		}
		allImages = append(allImages, g.Images()...)
	}
	return allImages, nil
}

// GenerateImagePrompt uses the default LLM endpoint to generate image generation prompts.
// style: "natural" or "danbooru".
func (a *App) GenerateImagePrompt(charID int, style string) (string, string, error) {
	a.mu.Lock()
	var target compose.Character
	for _, c := range a.characters {
		if c.ID == charID {
			target = c
			break
		}
	}
	def := a.defaultEndpoint()
	a.mu.Unlock()

	if def.URL == "" {
		return "", "", fmt.Errorf("no default LLM endpoint configured")
	}

	ep := llm.LLMEndpoint{
		ID:           def.ID,
		Name:         def.Name,
		URL:          def.URL,
		Model:        def.Model,
		Key:          def.Key,
		ContextSize:  def.ContextSize,
		Temperature:  def.Temperature,
	}

	result, err := llm.Complete(ep, buildImagePromptSysMsg(target, style), buildImagePromptUserMsg(target))
	if err != nil {
		return "", "", fmt.Errorf("generate image prompt: %w", err)
	}

	positive, negative := parseImagePromptResult(result)
	return positive, negative, nil
}

// GetComfyWorkflowByName returns a saved workflow by name, or the first workflow if name is empty.
func (a *App) GetComfyWorkflowByName(name string) (comfy.ComfyWorkflow, error) {
	for _, wf := range a.settings.Comfy.Workflows {
		if wf.Name == name || name == "" {
			return wf, nil
		}
	}
	return comfy.ComfyWorkflow{}, workflowNotFound(name)
}

// GetComfyWorkflowTemplate returns the workflow template JSON for a given workflow ID.
// Returns the built-in template for known preset IDs, or the stored template/data for saved workflows.
func (a *App) GetComfyWorkflowTemplate(id string) ([]byte, error) {
	if tmpl, ok := comfy.GetBuiltInTemplate(id); ok {
		return tmpl, nil
	}

	for _, wf := range a.settings.Comfy.Workflows {
		if wf.ID == id {
			if len(wf.Template) > 0 {
				return wf.Template, nil
			}
			return wf.JSONData, nil
		}
	}

	return nil, workflowNotFound(id)
}

// SaveComfyWorkflowTemplate stores an edited workflow template.
func (a *App) SaveComfyWorkflowTemplate(id string, template json.RawMessage) error {
	for i, wf := range a.settings.Comfy.Workflows {
		if wf.ID == id {
			a.settings.Comfy.Workflows[i].Template = template
			return settings.Save(a.settings)
		}
	}
	return workflowNotFound(id)
}

func (a *App) comfyClient() (*comfy.Client, error) {
	url := a.settings.Comfy.URL
	if url == "" {
		return nil, fmt.Errorf("ComfyUI URL not configured")
	}
	var t *string
	if a.settings.Comfy.AuthToken != nil {
		t = a.settings.Comfy.AuthToken
	}
	return comfy.NewClient(url, t), nil
}

// GetComfySamplers returns available sampler names from ComfyUI.
func (a *App) GetComfySamplers() ([]string, error) {
	client, err := a.comfyClient()
	if err != nil {
		return nil, err
	}
	return client.GetNodeInputList("KSampler", "sampler_name")
}

// GetComfySchedulers returns available scheduler names from ComfyUI.
func (a *App) GetComfySchedulers() ([]string, error) {
	client, err := a.comfyClient()
	if err != nil {
		return nil, err
	}
	return client.GetNodeInputList("KSampler", "scheduler")
}

// GetComfyCheckpoints returns available checkpoint model names from ComfyUI.
func (a *App) GetComfyCheckpoints() ([]string, error) {
	client, err := a.comfyClient()
	if err != nil {
		return nil, err
	}
	return client.GetNodeInputList("CheckpointLoaderSimple", "ckpt_name")
}

// GetComfyVAEs returns available VAE model names from ComfyUI.
func (a *App) GetComfyVAEs() ([]string, error) {
	client, err := a.comfyClient()
	if err != nil {
		return nil, err
	}
	return client.GetNodeInputList("VAELoader", "vae_name")
}

// GetComfyLoRAs returns available LoRA model names from ComfyUI.
func (a *App) GetComfyLoRAs() ([]string, error) {
	client, err := a.comfyClient()
	if err != nil {
		return nil, err
	}
	return client.GetNodeInputList("LoraLoader", "lora_name")
}

// ParseComfyWorkflowParams extracts WorkflowParams from raw workflow JSON.
func (a *App) ParseComfyWorkflowParams(jsonData json.RawMessage) (comfy.WorkflowParams, error) {
	wf, err := comfy.ParseWorkflow(jsonData)
	if err != nil {
		return comfy.WorkflowParams{}, err
	}
	return wf.ExtractParams(0), nil
}

// CrawlPage fetches a wiki page via the MediaWiki API and returns parsed content.
func (a *App) CrawlPage(pageURL string, opts crawler.CrawlOptions) crawler.CrawlResult {
	result := crawler.FetchPage(pageURL)
	if result.Error != nil {
		fmt.Println("[app] CrawlPage fetch error:", result.Error)
		return crawler.CrawlResult{
			URL:        pageURL,
			Domain:     result.Domain,
			StatusCode: 0,
			LatencyMs:  result.LatencyMs,
		}
	}
	sections, infobox := crawler.SectionsFromRawHTML(result.RawHTML, opts.Include)
	cr := crawler.CrawlResult{
		Title:      result.Title,
		URL:        pageURL,
		Domain:     result.Domain,
		RawHTML:    result.RawHTML,
		Sections:   sections,
		Infobox:    infobox,
		WordCount:  crawler.TotalWordCount(sections, infobox),
		StatusCode: 200,
		LatencyMs:  result.LatencyMs,
	}
	fmt.Printf("[app] CrawlPage done: title=%q sections=%d infobox=%d words=%d rawHTML=%d\n",
		cr.Title, len(cr.Sections), len(cr.Infobox), cr.WordCount, len(cr.RawHTML))
	a.mu.Lock()
	a.cachedCrawl = &cr
	a.mu.Unlock()
	if err := crawler.SaveCache(cr); err != nil {
		fmt.Println("cache save error:", err)
	}
	return cr
}

// GetCachedCrawl returns the previously cached crawl result, if any.
func (a *App) GetCachedCrawl() *crawler.CrawlResult {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.cachedCrawl
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetCharacters returns all characters in the current project.
func (a *App) GetCharacters() []compose.Character {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.characters
}

// AddCharacter creates a new character and returns it.
func (a *App) AddCharacter() compose.Character {
	a.mu.Lock()
	defer a.mu.Unlock()
	nextID := a.nextCharID()
	ch := compose.NewCharacter(nextID)
	a.characters = append(a.characters, ch)
	a.activeCharID = nextID
	return ch
}

// UpdateCharacter replaces a character by ID with the given data.
func (a *App) UpdateCharacter(ch compose.Character) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i, c := range a.characters {
		if c.ID == ch.ID {
			a.characters[i] = ch
			return nil
		}
	}
	return charNotFound(ch.ID)
}

// DeleteCharacter removes a character by ID.
func (a *App) DeleteCharacter(id int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(a.characters) <= 1 {
		return fmt.Errorf("cannot delete the last character")
	}
	for i, c := range a.characters {
		if c.ID == id {
			a.characters = append(a.characters[:i], a.characters[i+1:]...)
			if a.activeCharID == id {
				if i >= len(a.characters) {
					a.activeCharID = a.characters[0].ID
				} else {
					a.activeCharID = a.characters[i].ID
				}
			}
			return nil
		}
	}
	return charNotFound(id)
}

// GetActiveCharacter returns the currently active character.
func (a *App) GetActiveCharacter() compose.Character {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, c := range a.characters {
		if c.ID == a.activeCharID {
			return c
		}
	}
	return compose.Character{}
}

// SetActiveCharacter switches the active character by ID.
func (a *App) SetActiveCharacter(id int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.activeCharID = id
}

// CountTokens returns the approximate token count for text.
func (a *App) CountTokens(text string) int {
	return compose.CountTokens(text)
}

func (a *App) nextCharID() int {
	max := 0
	for _, c := range a.characters {
		if c.ID > max {
			max = c.ID
		}
	}
	return max + 1
}

// GenerateCharacterBulk sends the cached crawl to the default LLM endpoint
// and generates a character from the bulk prompt. lockedFields are field IDs
// that should not be overwritten.
func (a *App) GenerateCharacterBulk(lockedFields []string) compose.Character {
	a.mu.Lock()
	crawl := a.cachedCrawl
	existing := compose.Character{}
	for _, c := range a.characters {
		if c.ID == a.activeCharID {
			existing = c
			break
		}
	}
	a.mu.Unlock()

	if crawl == nil {
		return existing
	}

	a.mu.Lock()
	def := a.defaultEndpoint()
	a.mu.Unlock()

	ep := llm.LLMEndpoint{
		ID:           def.ID,
		Name:         def.Name,
		URL:          def.URL,
		Model:        def.Model,
		Key:          def.Key,
		ContextSize:  def.ContextSize,
		Temperature:  def.Temperature,
		SystemPrompt: def.SystemPrompt,
	}

	ch, err := compose.GenerateBulk(*crawl, ep, lockedFields, existing)
	if err != nil {
		fmt.Println("bulk generate error:", err)
		return existing
	}

	a.mu.Lock()
	for i, c := range a.characters {
		if c.ID == a.activeCharID {
			ch.ID = c.ID
			a.characters[i] = ch
			break
		}
	}
	a.mu.Unlock()

	return ch
}

// GenerateField sends a per-field prompt to the LLM for a single character field.
func (a *App) GenerateField(fieldID, customPrompt string) compose.Character {
	a.mu.Lock()
	crawl := a.cachedCrawl
	existing := compose.Character{}
	for _, c := range a.characters {
		if c.ID == a.activeCharID {
			existing = c
			break
		}
	}
	def := a.defaultEndpoint()
	templates := a.settings.PromptTemplates
	if len(templates.FieldPrompts) == 0 {
		templates = prompts.Defaults()
	}
	a.mu.Unlock()

	if crawl == nil {
		return existing
	}

	ep := llm.LLMEndpoint{
		ID:           def.ID,
		Name:         def.Name,
		URL:          def.URL,
		Model:        def.Model,
		Key:          def.Key,
		ContextSize:  def.ContextSize,
		Temperature:  def.Temperature,
		SystemPrompt: def.SystemPrompt,
	}

	ch, err := compose.GenerateField(fieldID, *crawl, ep, customPrompt, existing, templates)
	if err != nil {
		fmt.Println("generate field error:", err)
		return existing
	}

	a.mu.Lock()
	for i, c := range a.characters {
		if c.ID == a.activeCharID {
			ch.ID = c.ID
			a.characters[i] = ch
			break
		}
	}
	a.mu.Unlock()

	return ch
}

func (a *App) defaultEndpoint() settings.LLMEndpoint {
	for _, ep := range a.settings.Endpoints {
		if ep.IsDefault {
			return ep
		}
	}
	if len(a.settings.Endpoints) > 0 {
		return a.settings.Endpoints[0]
	}
	return settings.LLMEndpoint{}
}

// PickSaveBundle opens a native save dialog for creating a .slv project bundle.
func (a *App) PickSaveBundle() (string, error) {
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save project bundle",
		DefaultFilename: "silly-sleeve-project.slv",
		Filters: []runtime.FileFilter{
			{DisplayName: "Silly Sleeve Bundle (*.slv)", Pattern: "*.slv"},
		},
	})
	if err != nil {
		return "", err
	}
	return filePath, nil
}

// SaveProjectBundle writes the current project state as a .slv bundle.
func (a *App) SaveProjectBundle(filePath string) error {
	a.mu.Lock()
	chars := make([]compose.Character, len(a.characters))
	copy(chars, a.characters)
	activeID := a.activeCharID
	sourceURL := ""
	crawlTitle := ""
	var cachedCrawl *crawler.CrawlResult
	if a.cachedCrawl != nil {
		sourceURL = a.cachedCrawl.URL
		crawlTitle = a.cachedCrawl.Title
		cachedCrawl = a.cachedCrawl
	}
	templates := a.settings.PromptTemplates
	if len(templates.FieldPrompts) == 0 {
		templates = prompts.Defaults()
	}
	entries := make([]lorebook.Entry, len(a.lorebookEntries))
	copy(entries, a.lorebookEntries)
	projImg := make([]byte, len(a.projectImage))
	copy(projImg, a.projectImage)
	a.mu.Unlock()

	projectName := "Untitled Project"
	if len(chars) > 0 && chars[0].Name != "Untitled" {
		projectName = chars[0].Name
	}
	if crawlTitle != "" {
		projectName = crawlTitle
	}

	m := project.ProjectManifest{
		Name:         projectName,
		ActiveCharID: activeID,
		SourceURL:    sourceURL,
		CrawlTitle:   crawlTitle,
		ProjectImage: projImg,
	}

	b := bundle.Bundle{
		Manifest:   m,
		Characters:  chars,
		Lorebook:   entries,
		Prompts:    templates,
		CrawlCache: cachedCrawl,
	}

	if err := bundle.WriteBundle(filePath, b); err != nil {
		return err
	}

	a.mu.Lock()
	a.projectDir = filePath
	a.mu.Unlock()
	return nil
}

// PickOpenBundle opens a native file picker for loading a .slv project bundle.
func (a *App) PickOpenBundle() (string, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open project bundle",
		Filters: []runtime.FileFilter{
			{DisplayName: "Silly Sleeve Bundle (*.slv)", Pattern: "*.slv"},
		},
	})
	if err != nil {
		return "", err
	}
	return filePath, nil
}

// OpenProjectBundle loads a project from a .slv bundle file.
func (a *App) OpenProjectBundle(filePath string) (project.ProjectManifest, error) {
	if filePath == "" {
		return project.ProjectManifest{}, fmt.Errorf("no file selected")
	}

	b, err := bundle.ReadBundle(filePath)
	if err != nil {
		return project.ProjectManifest{}, err
	}

	a.mu.Lock()
	a.characters = b.Characters
	a.activeCharID = b.Manifest.ActiveCharID
	a.projectDir = filePath
	a.lorebookEntries = b.Lorebook
	a.projectImage = b.Manifest.ProjectImage

	if len(a.characters) == 0 {
		a.characters = []compose.Character{compose.NewCharacter(1)}
		a.activeCharID = 1
	}

	if b.CrawlCache != nil {
		a.cachedCrawl = b.CrawlCache
	} else if b.Manifest.CrawlTitle != "" {
		c, err := crawler.LoadCache()
		if err == nil && c != nil && c.Title == b.Manifest.CrawlTitle {
			a.cachedCrawl = c
		}
	}

	if len(b.Prompts.FieldPrompts) > 0 {
		a.settings.PromptTemplates = b.Prompts
	}
	a.mu.Unlock()

	return b.Manifest, nil
}

// PickExportFolder opens a native folder picker for exporting characters.
func (a *App) PickExportFolder() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose export folder",
	})
	if err != nil {
		return "", err
	}
	return dir, nil
}

// ExportCharacter exports a single character as SillyTavern-compatible JSON.
func (a *App) ExportCharacter(charID int, folderPath string) (string, error) {
	a.mu.Lock()
	charCopy := make([]compose.Character, len(a.characters))
	copy(charCopy, a.characters)
	a.mu.Unlock()

	var found *compose.Character
	for i := range charCopy {
		if charCopy[i].ID == charID {
			found = &charCopy[i]
			break
		}
	}
	if found == nil {
		return "", charNotFound(charID)
	}

	// export will be written by the export package
	filePath, writeErr := saveCharacterAsST(*found, folderPath)
	if writeErr != nil {
		return "", writeErr
	}
	return filePath, nil
}

// GetLorebook returns all lorebook entries.
func (a *App) GetLorebook() []lorebook.Entry {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.lorebookEntries
}

// SaveLorebook replaces all lorebook entries.
func (a *App) SaveLorebook(entries []lorebook.Entry) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lorebookEntries = entries
}

// ExportLorebook writes lorebook entries to a world_info.json file.
func (a *App) ExportLorebook(folderPath string) (string, error) {
	a.mu.Lock()
	entries := make([]lorebook.Entry, len(a.lorebookEntries))
	copy(entries, a.lorebookEntries)
	a.mu.Unlock()

	filePath := folderPath + "/world_info.json"
	if err := lorebook.ExportWorldInfo(entries, filePath); err != nil {
		return "", err
	}
	return filePath, nil
}

// GetPortrait returns the portrait bytes for a character.
func (a *App) GetPortrait(charID int) []byte {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, c := range a.characters {
		if c.ID == charID {
			return c.Portrait
		}
	}
	return nil
}

// SavePortrait stores portrait bytes for a character.
func (a *App) SavePortrait(charID int, data []byte) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i, c := range a.characters {
		if c.ID == charID {
			a.characters[i].Portrait = data
			return nil
		}
	}
	return charNotFound(charID)
}

// GetProjectImage returns the project-level cover image.
func (a *App) GetProjectImage() []byte {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.projectImage
}

// SaveProjectImage stores the project-level cover image.
func (a *App) SaveProjectImage(data []byte) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.projectImage = data
}

func charNotFound(id int) error {
	return fmt.Errorf("character %d not found", id)
}

func workflowNotFound(id string) error {
	return fmt.Errorf("workflow %q not found", id)
}

func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "_", "-")
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	result := b.String()
	result = strings.Trim(result, "-")
	var sb strings.Builder
	prevDash := false
	for _, r := range result {
		if r == '-' {
			if prevDash {
				continue
			}
			prevDash = true
		} else {
			prevDash = false
		}
		sb.WriteRune(r)
	}
	return sb.String()
}

func saveCharacterAsST(ch compose.Character, folderPath string) (string, error) {
	// Build SillyTavern-compatible description from all text fields
	var descParts []string
	if ch.Appearance != "" {
		descParts = append(descParts, "### Appearance\n"+ch.Appearance)
	}
	if ch.Personality != "" {
		descParts = append(descParts, "### Personality\n"+ch.Personality)
	}
	if ch.Backstory != "" {
		descParts = append(descParts, "### Backstory\n"+ch.Backstory)
	}
	if ch.Abilities != "" {
		descParts = append(descParts, "### Abilities & Skills\n"+ch.Abilities)
	}
	if ch.Relationships != "" {
		descParts = append(descParts, "### Relationships\n"+ch.Relationships)
	}
	if len(ch.Stats) > 0 {
		var sb strings.Builder
		sb.WriteString("### Stats\n")
		for _, s := range ch.Stats {
			if s.Key != "" || s.Value != "" {
				sb.WriteString(fmt.Sprintf("- **%s**: %s\n", s.Key, s.Value))
			}
		}
		descParts = append(descParts, sb.String())
	}

	firstMes := ""
	mesExample := ""
	if len(ch.Quotes) > 0 {
		firstMes = ch.Quotes[0]
		if len(ch.Quotes) > 1 {
			var sb strings.Builder
			for i, q := range ch.Quotes[1:] {
				if i > 0 {
					sb.WriteString("\n")
				}
				sb.WriteString("<START>\n{{user}}: ...\n{{char}}: " + q + "\n")
			}
			mesExample = sb.String()
		}
	}

	st := map[string]any{
		"name":              ch.Name,
		"description":       strings.Join(descParts, "\n\n"),
		"personality":       ch.Personality,
		"scenario":          "",
		"first_mes":         firstMes,
		"mes_example":       mesExample,
		"creatorcomment":    ch.Epithet,
		"tags":              ch.Tags,
		"creator":           "Silly Sleeve",
		"character_version": "1.0",
	}

	// Ensure tags is an array in JSON even when empty
	if st["tags"] == nil {
		st["tags"] = []string{}
	}

	data, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return "", err
	}

	fname := slugify(ch.Name)
	if fname == "" {
		fname = "character"
	}
	filePath := folderPath + "/" + fname + ".json"
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return "", fmt.Errorf("write character JSON: %w", err)
	}
	return filePath, nil
}
