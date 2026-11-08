import { describe, it, expect, vi, beforeEach } from 'vitest';

// The wrappers are 1:1 pass-throughs to the RPC client; the contract that
// matters is method name + positional arg order, so this table asserts both
// for every exported method.
const mockCall = vi.fn().mockResolvedValue(null);
vi.mock('./client', () => ({
  call: (method: string, args?: unknown[]) => mockCall(method, args),
}));

import * as api from './app';

/** [method, argument count] — mirrors the Go App method surface. */
const METHODS: Array<[string, number]> = [
  ['AddCharacter', 0],
  ['ApplyLorebookSuggestions', 1],
  ['ApproveLorebookCandidates', 1],
  ['ClearCrawl', 0],
  ['CountTokens', 1],
  ['CrawlPage', 2],
  ['DeleteCharacter', 1],
  ['DeleteComfyWorkflow', 1],
  ['DiscardLorebookCandidates', 1],
  ['ExportCharacter', 2],
  ['ExportCharacterPNG', 4],
  ['ExportCharactersBulk', 4],
  ['ExportLorebook', 1],
  ['ExtractLorebookCandidates', 1],
  ['GenerateCharacterBulk', 1],
  ['GenerateField', 2],
  ['GenerateImagePrompt', 2],
  ['GeneratePortrait', 1],
  ['GenerateProjectImage', 1],
  ['GetActiveCharacter', 0],
  ['GetCachedCrawl', 0],
  ['GetCardPreview', 0],
  ['GetCharacters', 0],
  ['GetComfyCLIPs', 0],
  ['GetComfyCheckpoints', 0],
  ['GetComfyConfig', 0],
  ['GetComfyLoRAs', 0],
  ['GetComfySamplers', 0],
  ['GetComfySchedulers', 0],
  ['GetComfyUNets', 0],
  ['GetComfyVAEs', 0],
  ['GetComfyWorkflowByName', 1],
  ['GetComfyWorkflowTemplate', 1],
  ['GetComfyWorkflows', 0],
  ['GetCrawlForCharacter', 1],
  ['GetCrawlState', 0],
  ['GetDefaultPromptTemplates', 0],
  ['GetExportDir', 0],
  ['GetLorebook', 0],
  ['GetLorebookCandidates', 0],
  ['GetLorebookSuggestions', 0],
  ['GetPortrait', 1],
  ['GetProjectFieldEndpoints', 0],
  ['GetProjectImage', 0],
  ['GetProjectName', 0],
  ['GetProjectThumbnail', 1],
  ['GetPromptTemplates', 0],
  ['GetSettings', 0],
  ['GetStagedSources', 0],
  ['ImportCardFile', 1],
  ['ImportComfyWorkflow', 1],
  ['ImportLorebookFile', 1],
  ['ListProjects', 0],
  ['NewProject', 1],
  ['OpenProjectBundle', 1],
  ['ParseComfyWorkflowParams', 1],
  ['RefetchCrawlResult', 1],
  ['RemoveCrawlResult', 1],
  ['RemoveProject', 2],
  ['RemoveStagedSource', 1],
  ['SaveComfyWorkflowTemplate', 2],
  ['SaveCrawlState', 1],
  ['SaveLorebook', 1],
  ['SavePortrait', 2],
  ['SaveProjectAsName', 1],
  ['SaveProjectBundle', 1],
  ['SaveProjectImage', 1],
  ['SavePromptTemplates', 1],
  ['SaveSettings', 1],
  ['SendCrawlResult', 3],
  ['SetActiveCharacter', 1],
  ['SetProjectFieldEndpoint', 2],
  ['SetProjectStatus', 2],
  ['SetStagedSourceMode', 2],
  ['SetStagedSourceStyle', 2],
  ['SuggestLorebookConnections', 0],
  ['TestComfyUIEndpoint', 2],
  ['TestLLMEndpoint', 1],
  ['UpdateCharacter', 1],
  ['UpdateCrawlSummary', 2],
];

const apiAny = api as Record<string, unknown>;

describe('api/app wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(METHODS)('wraps %s with the correct method name and arity (%#)', async (name, arity) => {
    const fn = apiAny[name];
    expect(typeof fn, `${name} should be an exported function`).toBe('function');

    const args = Array.from({ length: arity }, (_, i) => `arg${i}`);
    await (fn as (...a: unknown[]) => Promise<unknown>)(...args);

    expect(mockCall).toHaveBeenCalledTimes(1);
    const [method, passed] = mockCall.mock.calls[0];
    expect(method).toBe(name);
    if (arity === 0) {
      expect(passed).toBeUndefined();
    } else {
      expect(passed).toEqual(args);
    }
  });

  it('exports exactly the Go method surface (no stale Wails methods)', () => {
    const exported = Object.keys(apiAny).filter(k => typeof apiAny[k] === 'function').sort();
    expect(exported).toEqual(METHODS.map(([m]) => m).sort());
    // Methods that existed only in the Wails bridge must stay gone.
    for (const gone of ['Greet', 'PickSaveBundle', 'PickOpenBundle', 'PickExportFolder', 'ImportCard', 'ImportLorebook', 'ReadImageFile']) {
      expect(apiAny[gone], `${gone} should not be re-exported`).toBeUndefined();
    }
  });
});
