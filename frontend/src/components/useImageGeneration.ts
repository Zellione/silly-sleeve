import { useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastProvider';
import {
  GetComfySamplers, GetComfySchedulers, GetComfyCheckpoints,
  GetComfyWorkflows, GetComfyWorkflowTemplate,
} from '../../wailsjs/go/main/App';
import { comfy } from '../../wailsjs/go/models';
import type { WorkflowOption } from './GenerationParamsPanel';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { mapWorkflows, parseSize } from '../utils/workflow';
import { arrayBufferToDataURL } from '../utils/image';

export interface GenerationRequest {
  size: string;
  seed: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  denoise: number;
  prompt: string;
  negPrompt: string;
  checkpoint: string;
}

export interface UseImageGenerationOptions {
  /** Currently selected workflow id; drives template (re)loading. */
  workflowId: string;
  /** Built-in workflow presets, prepended to the uploaded ones. */
  workflowDefaults: WorkflowOption[];
  /** Backend call that runs the generation and returns the images. */
  generate: (params: comfy.GenerationParams) => Promise<comfy.CompletedImage[]>;
  /** Success toast body, given the number of images produced. */
  completionBody: (count: number) => string;
  /** Checkpoint shown before the server list loads. */
  initialCheckpoint?: string;
}

/**
 * Shared ComfyUI image-generation state for the Portrait and Project Image
 * screens: loads sampler/scheduler/checkpoint/workflow lists, tracks the
 * selected workflow's template, subscribes to comfy progress/error events, and
 * runs a generation (building params, decoding images, surfacing toasts).
 */
export function useImageGeneration({
  workflowId,
  workflowDefaults,
  generate,
  completionBody,
  initialCheckpoint = '',
}: UseImageGenerationOptions) {
  const { toast } = useToast();

  const [samplers, setSamplers] = useState<string[]>([]);
  const [schedulers, setSchedulers] = useState<string[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState(initialCheckpoint);
  const [uploadedWorkflows, setUploadedWorkflows] = useState<WorkflowOption[]>([]);
  const [workflowTemplate, setWorkflowTemplate] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);

  useEffect(() => {
    GetComfySamplers().then(setSamplers).catch(() => {});
    GetComfySchedulers().then(setSchedulers).catch(() => {});
    GetComfyCheckpoints().then(list => {
      setCheckpoints(list);
      if (list.length > 0) setCheckpoint(list[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    GetComfyWorkflows().then(wfs => setUploadedWorkflows(mapWorkflows(wfs))).catch(() => {});
  }, []);

  useEffect(() => {
    GetComfyWorkflowTemplate(workflowId).then(setWorkflowTemplate).catch(() => {});
  }, [workflowId]);

  useEffect(() => {
    /* v8 ignore start */
    EventsOn('comfy:progress', (e: { progress: number; max: number }) => {
      if (e.max > 0) setProgress(Math.round((e.progress / e.max) * 100));
    });
    EventsOn('comfy:error', (e: { error: string }) => {
      toast({ kind: 'bad', title: 'Generation error', body: e.error });
    });
    return () => {
      EventsOff('comfy:progress');
      EventsOff('comfy:error');
    };
    /* v8 ignore stop */
  }, [toast]);

  const allWorkflows = [...workflowDefaults, ...uploadedWorkflows];

  const clearVariants = useCallback(() => setVariantImages([]), []);
  const stop = useCallback(() => setGenerating(false), []);

  const runGeneration = useCallback(async (req: GenerationRequest) => {
    if (generating) return;
    if (!workflowTemplate) {
      toast({ kind: 'warn', title: 'Loading', body: 'Workflow template not ready yet. Try again in a moment.' });
      return;
    }
    setGenerating(true);
    setProgress(0);
    setVariantImages([]);

    const [width, height] = parseSize(req.size);
    try {
      const params = new comfy.GenerationParams({
        workflowTemplate,
        seed: req.seed,
        steps: req.steps,
        cfg: req.cfg,
        sampler: req.sampler,
        scheduler: req.scheduler,
        denoise: req.denoise,
        positivePrompt: req.prompt,
        negativePrompt: req.negPrompt,
        width,
        height,
        checkpoint: req.checkpoint,
      });
      const images = await generate(params);
      setVariantImages(images.map(img => arrayBufferToDataURL(img.data)));
      setProgress(100);
      toast({ kind: 'ok', title: 'Generation complete', body: completionBody(images.length) });
    } catch (err) {
      toast({ kind: 'bad', title: 'Generation failed', body: String(err) });
    } finally {
      setGenerating(false);
    }
  }, [generating, workflowTemplate, generate, completionBody, toast]);

  return {
    samplers,
    schedulers,
    checkpoints,
    checkpoint,
    setCheckpoint,
    allWorkflows,
    workflowTemplate,
    generating,
    progress,
    variantImages,
    selectedVariant,
    setSelectedVariant,
    clearVariants,
    stop,
    runGeneration,
  };
}
