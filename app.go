package main

import (
	"context"
	"fmt"
	"sync"

	"silly-sleeve/internal/comfy"
	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/llm"
	"silly-sleeve/internal/lorebook"
	"silly-sleeve/internal/project"
	"silly-sleeve/internal/prompts"
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
	fieldEndpoints  map[string]int

	comfy   *ComfyUIService
	charGen *CharacterGenerator
	project *ProjectManager
	library *LibraryManager
}

// NewApp creates a new App application struct
func NewApp() *App {
	a := &App{}
	ctxFn := func() context.Context { return a.ctx }
	a.comfy = &ComfyUIService{
		settings: &a.settings,
		ctx:      ctxFn,
	}
	a.charGen = &CharacterGenerator{ctx: ctxFn, completer: llm.DefaultCompleter}
	a.project = &ProjectManager{ctx: ctxFn}
	return a
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

	if lm, err := NewLibraryManager(); err != nil {
		fmt.Println("library init error:", err)
	} else {
		a.library = lm
	}
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
	return a.comfy.GetComfyConfig()
}

// ImportComfyWorkflow reads a workflow JSON file, parses it, and stores it in settings.
func (a *App) ImportComfyWorkflow(filePath string) (comfy.ComfyWorkflow, error) {
	return a.comfy.ImportComfyWorkflow(filePath)
}

// GetComfyWorkflows returns all saved ComfyUI workflows.
func (a *App) GetComfyWorkflows() []comfy.ComfyWorkflow {
	return a.comfy.GetComfyWorkflows()
}

// DeleteComfyWorkflow removes a workflow by ID.
func (a *App) DeleteComfyWorkflow(id string) error {
	return a.comfy.DeleteComfyWorkflow(id)
}

// TestComfyUIEndpoint verifies connectivity to a ComfyUI instance.
func (a *App) TestComfyUIEndpoint(url, token string) llm.TestResult {
	return a.comfy.TestComfyUIEndpoint(url, token)
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
	return a.comfy.GeneratePortrait(params)
}

// GenerateProjectImage starts 3 ComfyUI generation jobs with seed offsets and returns the images.
func (a *App) GenerateProjectImage(params comfy.GenerationParams) ([]comfy.CompletedImage, error) {
	return a.comfy.GenerateProjectImage(params)
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

	return a.charGen.GenerateImagePrompt(target, def, style)
}

// GetComfyWorkflowByName returns a saved workflow by name, or the first workflow if name is empty.
func (a *App) GetComfyWorkflowByName(name string) (comfy.ComfyWorkflow, error) {
	return a.comfy.GetComfyWorkflowByName(name)
}

// GetComfyWorkflowTemplate returns the workflow template JSON for a given workflow ID.
// Returns the built-in template for known preset IDs, or the stored template/data for saved workflows.
func (a *App) GetComfyWorkflowTemplate(id string) (string, error) {
	return a.comfy.GetComfyWorkflowTemplate(id)
}

// SaveComfyWorkflowTemplate stores an edited workflow template.
func (a *App) SaveComfyWorkflowTemplate(id, template string) error {
	return a.comfy.SaveComfyWorkflowTemplate(id, template)
}

// GetComfySamplers returns available sampler names from ComfyUI.
func (a *App) GetComfySamplers() ([]string, error) {
	return a.comfy.GetComfySamplers()
}

// GetComfySchedulers returns available scheduler names from ComfyUI.
func (a *App) GetComfySchedulers() ([]string, error) {
	return a.comfy.GetComfySchedulers()
}

// GetComfyCheckpoints returns available checkpoint model names from ComfyUI.
func (a *App) GetComfyCheckpoints() ([]string, error) {
	return a.comfy.GetComfyCheckpoints()
}

// GetComfyVAEs returns available VAE model names from ComfyUI.
func (a *App) GetComfyVAEs() ([]string, error) {
	return a.comfy.GetComfyVAEs()
}

// GetComfyLoRAs returns available LoRA model names from ComfyUI.
func (a *App) GetComfyLoRAs() ([]string, error) {
	return a.comfy.GetComfyLoRAs()
}

// ParseComfyWorkflowParams extracts WorkflowParams from raw workflow JSON.
func (a *App) ParseComfyWorkflowParams(jsonData string) (comfy.WorkflowParams, error) {
	return a.comfy.ParseComfyWorkflowParams(jsonData)
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

// activeCharacterLocked returns the active character. Caller holds a.mu.
func (a *App) activeCharacterLocked() compose.Character {
	for _, c := range a.characters {
		if c.ID == a.activeCharID {
			return c
		}
	}
	if len(a.characters) > 0 {
		return a.characters[0]
	}
	return compose.NewCharacter(1)
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

	ch, err := a.charGen.GenerateBulk(*crawl, def, lockedFields, existing)
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

	ch, err := a.charGen.GenerateField(fieldID, customPrompt, *crawl, def, existing, templates)
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

// endpointForSlot resolves which LLM endpoint a generation slot ("bulk" or a
// field id) should use. Precedence: per-project override, then global default,
// then defaultEndpoint(). A referenced endpoint ID that no longer exists falls
// through to the next level. Callers must hold a.mu.
func (a *App) endpointForSlot(slot string) settings.LLMEndpoint {
	if ep, ok := a.lookupEndpoint(a.fieldEndpoints[slot]); ok {
		return ep
	}
	if ep, ok := a.lookupEndpoint(a.settings.FieldEndpoints[slot]); ok {
		return ep
	}
	return a.defaultEndpoint()
}

// lookupEndpoint returns the endpoint with the given ID. An id <= 0 (unset) or
// an unknown ID returns ok=false. Callers must hold a.mu.
func (a *App) lookupEndpoint(id int) (settings.LLMEndpoint, bool) {
	if id <= 0 {
		return settings.LLMEndpoint{}, false
	}
	for _, ep := range a.settings.Endpoints {
		if ep.ID == id {
			return ep, true
		}
	}
	return settings.LLMEndpoint{}, false
}

// PickSaveBundle opens a native save dialog for creating a .slv project bundle.
func (a *App) PickSaveBundle() (string, error) {
	return a.project.PickSaveBundle()
}

// SaveProjectBundle writes the current project state as a .slv bundle.
// SaveProjectBundle writes the current project state as a .slv bundle.
func (a *App) SaveProjectBundle(filePath string) error {
	a.mu.Lock()
	chars := make([]compose.Character, len(a.characters))
	copy(chars, a.characters)
	snap := ProjectSnapshot{
		Characters:   chars,
		ActiveCharID: a.activeCharID,
	}
	if a.cachedCrawl != nil {
		snap.SourceURL = a.cachedCrawl.URL
		snap.CrawlTitle = a.cachedCrawl.Title
		snap.CrawlCache = a.cachedCrawl
	}
	snap.Prompts = a.settings.PromptTemplates
	if len(snap.Prompts.FieldPrompts) == 0 {
		snap.Prompts = prompts.Defaults()
	}
	entries := make([]lorebook.Entry, len(a.lorebookEntries))
	copy(entries, a.lorebookEntries)
	snap.Lorebook = entries
	projImg := make([]byte, len(a.projectImage))
	copy(projImg, a.projectImage)
	snap.ProjectImage = projImg
	a.mu.Unlock()

	// Preserve an existing project's status across re-saves (default draft).
	snap.Status = a.existingProjectStatus(filePath)

	manifest, err := a.project.SaveBundle(filePath, snap)
	if err != nil {
		return err
	}

	a.mu.Lock()
	a.projectDir = filePath
	active := a.activeCharacterLocked()
	a.mu.Unlock()

	a.registerInLibrary(filePath, manifest, active)
	return nil
}

// existingProjectStatus returns the status already recorded for filePath in the
// library, or "draft" when the project is new or the library is unavailable.
func (a *App) existingProjectStatus(filePath string) string {
	const defaultStatus = "draft"
	if a.library == nil {
		return defaultStatus
	}
	existing, err := a.library.List()
	if err != nil {
		return defaultStatus
	}
	for _, e := range existing {
		if e.Path == filePath && e.Status != "" {
			return e.Status
		}
	}
	return defaultStatus
}

// registerInLibrary records a saved/opened project in the library index. A
// registration failure is logged but does not fail the surrounding operation.
func (a *App) registerInLibrary(filePath string, manifest project.ProjectManifest, active compose.Character) {
	if a.library == nil {
		return
	}
	if err := a.library.Register(filePath, manifest, active); err != nil {
		fmt.Println("library register error:", err)
	}
}

// PickOpenBundle opens a native file picker for loading a .slv project bundle.
func (a *App) PickOpenBundle() (string, error) {
	return a.project.PickOpenBundle()
}

// OpenProjectBundle loads a project from a .slv bundle file.
func (a *App) OpenProjectBundle(filePath string) (project.ProjectManifest, error) {
	b, err := a.project.ReadBundle(filePath)
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

	if resolved := a.project.ResolveCrawlCache(b); resolved != nil {
		a.cachedCrawl = resolved
	}

	if len(b.Prompts.FieldPrompts) > 0 {
		a.settings.PromptTemplates = b.Prompts
	}
	active := a.activeCharacterLocked()
	a.mu.Unlock()

	a.registerInLibrary(filePath, b.Manifest, active)

	return b.Manifest, nil
}

// PickExportFolder opens a native folder picker for exporting characters.
func (a *App) PickExportFolder() (string, error) {
	return a.project.PickExportFolder()
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

	return a.project.ExportCharacter(*found, folderPath)
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

	return a.project.ExportLorebook(entries, folderPath)
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
