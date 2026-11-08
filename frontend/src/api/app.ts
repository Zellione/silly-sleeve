/**
 * Typed wrappers over the backend's JSON RPC bridge.
 *
 * Ported 1:1 from the generated Wails bindings (same names, same argument
 * order, same promise semantics — resolve with the return value, reject
 * with the error message), so existing call sites only change their import.
 * The removed methods (Greet, the Pick* dialogs, dialog-based imports,
 * ReadImageFile) are gone; the new ones (SaveProjectAsName, GetExportDir,
 * ImportCardFile, ImportLorebookFile) cover the browser file flows.
 */

import { call } from './client';
import {
  app,
  cardexport,
  comfy,
  compose,
  crawler,
  library,
  llm,
  lorebook,
  loreextract,
  project,
  prompts,
  settings,
} from './models';

// Go string-enum values the generated models file never emitted (the Wails
// d.ts referenced them as missing namespace members, masked by skipLibCheck).
export type ExtractionMode = 'split' | 'summary';
export type ContentStyle = 'prose' | 'factual';

export function AddCharacter(): Promise<compose.Character> {
  return call('AddCharacter');
}

export function ApplyLorebookSuggestions(arg1: Array<loreextract.Suggestion>): Promise<app.CrawlSendResult> {
  return call('ApplyLorebookSuggestions', [arg1]);
}

export function ApproveLorebookCandidates(arg1: Array<loreextract.Candidate>): Promise<Array<lorebook.Entry>> {
  return call('ApproveLorebookCandidates', [arg1]);
}

export function ClearCrawl(): Promise<void> {
  return call('ClearCrawl');
}

export function CountTokens(arg1: string): Promise<number> {
  return call('CountTokens', [arg1]);
}

export function CrawlPage(arg1: string, arg2: crawler.CrawlOptions): Promise<crawler.CrawlSet> {
  return call('CrawlPage', [arg1, arg2]);
}

export function DeleteCharacter(arg1: number): Promise<void> {
  return call('DeleteCharacter', [arg1]);
}

export function DeleteComfyWorkflow(arg1: string): Promise<void> {
  return call('DeleteComfyWorkflow', [arg1]);
}

export function DiscardLorebookCandidates(arg1: string): Promise<Array<loreextract.Candidate>> {
  return call('DiscardLorebookCandidates', [arg1]);
}

export function ExportCharacter(arg1: number, arg2: string): Promise<string> {
  return call('ExportCharacter', [arg1, arg2]);
}

export function ExportCharacterPNG(arg1: number, arg2: string, arg3: cardexport.Options, arg4: string): Promise<string> {
  return call('ExportCharacterPNG', [arg1, arg2, arg3, arg4]);
}

export function ExportCharactersBulk(arg1: Array<number>, arg2: string, arg3: cardexport.Options, arg4: string): Promise<app.ExportResult> {
  return call('ExportCharactersBulk', [arg1, arg2, arg3, arg4]);
}

export function ExportLorebook(arg1: string): Promise<string> {
  return call('ExportLorebook', [arg1]);
}

export function ExtractLorebookCandidates(arg1: string): Promise<Array<loreextract.Candidate>> {
  return call('ExtractLorebookCandidates', [arg1]);
}

export function GenerateCharacterBulk(arg1: Array<string>): Promise<compose.Character> {
  return call('GenerateCharacterBulk', [arg1]);
}

export function GenerateField(arg1: string, arg2: string): Promise<compose.Character> {
  return call('GenerateField', [arg1, arg2]);
}

export function GenerateImagePrompt(arg1: number, arg2: string): Promise<app.ImagePromptResult> {
  return call('GenerateImagePrompt', [arg1, arg2]);
}

export function GeneratePortrait(arg1: comfy.GenerationParams): Promise<Array<comfy.CompletedImage>> {
  return call('GeneratePortrait', [arg1]);
}

export function GenerateProjectImage(arg1: comfy.GenerationParams): Promise<Array<comfy.CompletedImage>> {
  return call('GenerateProjectImage', [arg1]);
}

export function GetActiveCharacter(): Promise<compose.Character> {
  return call('GetActiveCharacter');
}

export function GetCachedCrawl(): Promise<crawler.CrawlResult> {
  return call('GetCachedCrawl');
}

export function GetCardPreview(): Promise<compose.CardPreview> {
  return call('GetCardPreview');
}

export function GetCharacters(): Promise<Array<compose.Character>> {
  return call('GetCharacters');
}

export function GetComfyCLIPs(): Promise<Array<string>> {
  return call('GetComfyCLIPs');
}

export function GetComfyCheckpoints(): Promise<Array<string>> {
  return call('GetComfyCheckpoints');
}

export function GetComfyConfig(): Promise<settings.ComfyConfig> {
  return call('GetComfyConfig');
}

export function GetComfyLoRAs(): Promise<Array<string>> {
  return call('GetComfyLoRAs');
}

export function GetComfySamplers(): Promise<Array<string>> {
  return call('GetComfySamplers');
}

export function GetComfySchedulers(): Promise<Array<string>> {
  return call('GetComfySchedulers');
}

export function GetComfyUNets(): Promise<Array<string>> {
  return call('GetComfyUNets');
}

export function GetComfyVAEs(): Promise<Array<string>> {
  return call('GetComfyVAEs');
}

export function GetComfyWorkflowByName(arg1: string): Promise<comfy.ComfyWorkflow> {
  return call('GetComfyWorkflowByName', [arg1]);
}

export function GetComfyWorkflowTemplate(arg1: string): Promise<string> {
  return call('GetComfyWorkflowTemplate', [arg1]);
}

export function GetComfyWorkflows(): Promise<Array<comfy.ComfyWorkflow>> {
  return call('GetComfyWorkflows');
}

export function GetCrawlForCharacter(arg1: number): Promise<crawler.CrawlResult> {
  return call('GetCrawlForCharacter', [arg1]);
}

export function GetCrawlState(): Promise<app.CrawlState> {
  return call('GetCrawlState');
}

export function GetDefaultPromptTemplates(): Promise<prompts.TemplateSet> {
  return call('GetDefaultPromptTemplates');
}

export function GetExportDir(): Promise<string> {
  return call('GetExportDir');
}

export function GetLorebook(): Promise<Array<lorebook.Entry>> {
  return call('GetLorebook');
}

export function GetLorebookCandidates(): Promise<Array<loreextract.Candidate>> {
  return call('GetLorebookCandidates');
}

export function GetLorebookSuggestions(): Promise<Array<loreextract.Suggestion>> {
  return call('GetLorebookSuggestions');
}

export function GetPortrait(arg1: number): Promise<Array<number>> {
  return call('GetPortrait', [arg1]);
}

export function GetProjectFieldEndpoints(): Promise<Record<string, number>> {
  return call('GetProjectFieldEndpoints');
}

export function GetProjectImage(): Promise<Array<number>> {
  return call('GetProjectImage');
}

export function GetProjectName(): Promise<string> {
  return call('GetProjectName');
}

export function GetProjectThumbnail(arg1: string): Promise<Array<number>> {
  return call('GetProjectThumbnail', [arg1]);
}

export function GetPromptTemplates(): Promise<prompts.TemplateSet> {
  return call('GetPromptTemplates');
}

export function GetSettings(): Promise<settings.Settings> {
  return call('GetSettings');
}

export function GetStagedSources(): Promise<Array<loreextract.StagedSource>> {
  return call('GetStagedSources');
}

export function ImportCardFile(arg1: string): Promise<app.ImportCardResult> {
  return call('ImportCardFile', [arg1]);
}

export function ImportComfyWorkflow(arg1: string): Promise<comfy.ComfyWorkflow> {
  return call('ImportComfyWorkflow', [arg1]);
}

export function ImportLorebookFile(arg1: string): Promise<Array<lorebook.Entry>> {
  return call('ImportLorebookFile', [arg1]);
}

export function ListProjects(): Promise<Array<library.Entry>> {
  return call('ListProjects');
}

export function NewProject(arg1: string): Promise<string> {
  return call('NewProject', [arg1]);
}

export function OpenProjectBundle(arg1: string): Promise<project.ProjectManifest> {
  return call('OpenProjectBundle', [arg1]);
}

export function ParseComfyWorkflowParams(arg1: string): Promise<comfy.WorkflowParams> {
  return call('ParseComfyWorkflowParams', [arg1]);
}

export function RefetchCrawlResult(arg1: string): Promise<crawler.CrawlResult> {
  return call('RefetchCrawlResult', [arg1]);
}

export function RemoveCrawlResult(arg1: string): Promise<crawler.CrawlSet> {
  return call('RemoveCrawlResult', [arg1]);
}

export function RemoveProject(arg1: string, arg2: boolean): Promise<void> {
  return call('RemoveProject', [arg1, arg2]);
}

export function RemoveStagedSource(arg1: string): Promise<Array<loreextract.StagedSource>> {
  return call('RemoveStagedSource', [arg1]);
}

export function SaveComfyWorkflowTemplate(arg1: string, arg2: string): Promise<void> {
  return call('SaveComfyWorkflowTemplate', [arg1, arg2]);
}

export function SaveCrawlState(arg1: app.CrawlState): Promise<void> {
  return call('SaveCrawlState', [arg1]);
}

export function SaveLorebook(arg1: Array<lorebook.Entry>): Promise<void> {
  return call('SaveLorebook', [arg1]);
}

export function SavePortrait(arg1: number, arg2: Array<number>): Promise<void> {
  return call('SavePortrait', [arg1, arg2]);
}

export function SaveProjectAsName(arg1: string): Promise<string> {
  return call('SaveProjectAsName', [arg1]);
}

export function SaveProjectBundle(arg1: string): Promise<void> {
  return call('SaveProjectBundle', [arg1]);
}

export function SaveProjectImage(arg1: Array<number>): Promise<void> {
  return call('SaveProjectImage', [arg1]);
}

export function SavePromptTemplates(arg1: prompts.TemplateSet): Promise<void> {
  return call('SavePromptTemplates', [arg1]);
}

export function SaveSettings(arg1: settings.Settings): Promise<void> {
  return call('SaveSettings', [arg1]);
}

export function SendCrawlResult(arg1: string, arg2: string, arg3: boolean): Promise<app.SendCrawlOutcome> {
  return call('SendCrawlResult', [arg1, arg2, arg3]);
}

export function SetActiveCharacter(arg1: number): Promise<void> {
  return call('SetActiveCharacter', [arg1]);
}

export function SetProjectFieldEndpoint(arg1: string, arg2: number): Promise<void> {
  return call('SetProjectFieldEndpoint', [arg1, arg2]);
}

export function SetProjectStatus(arg1: string, arg2: string): Promise<void> {
  return call('SetProjectStatus', [arg1, arg2]);
}

export function SetStagedSourceMode(arg1: string, arg2: ExtractionMode): Promise<Array<loreextract.StagedSource>> {
  return call('SetStagedSourceMode', [arg1, arg2]);
}

export function SetStagedSourceStyle(arg1: string, arg2: ContentStyle): Promise<Array<loreextract.StagedSource>> {
  return call('SetStagedSourceStyle', [arg1, arg2]);
}

export function SuggestLorebookConnections(): Promise<Array<loreextract.Suggestion>> {
  return call('SuggestLorebookConnections');
}

export function TestComfyUIEndpoint(arg1: string, arg2: string): Promise<llm.TestResult> {
  return call('TestComfyUIEndpoint', [arg1, arg2]);
}

export function TestLLMEndpoint(arg1: settings.LLMEndpoint): Promise<llm.TestResult> {
  return call('TestLLMEndpoint', [arg1]);
}

export function UpdateCharacter(arg1: compose.Character): Promise<void> {
  return call('UpdateCharacter', [arg1]);
}

export function UpdateCrawlSummary(arg1: string, arg2: string): Promise<crawler.CrawlResult> {
  return call('UpdateCrawlSummary', [arg1, arg2]);
}
