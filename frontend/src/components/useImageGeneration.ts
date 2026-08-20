import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './ToastProvider';
import {
  GetComfySamplers, GetComfySchedulers, GetComfyCheckpoints,
  GetComfyUNets, GetComfyCLIPs, GetComfyVAEs, GetComfyLoRAs,
  GetComfyWorkflows, GetComfyWorkflowTemplate,
} from '../../wailsjs/go/app/App';
import { comfy } from '../../wailsjs/go/models';
import type { WorkflowOption } from './GenerationParamsPanel';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { mapWorkflows, parseSize, pickByHint } from '../utils/workflow';
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
  /** Checkpoint file — or the diffusion-model (UNet) file for split workflows. */
  checkpoint: string;
  /** Text encoder file for split workflows, '' for checkpoint workflows. */
  clip: string;
  /**
   * VAE model file, or '' to use the checkpoint's baked VAE. The backend omits
   * the VAELoader node from the built-in workflow when this is empty. Split
   * workflows have no baked VAE, so there '' blocks generation instead.
   */
  vae: string;
  /**
   * LoRA model file, or '' for no LoRA. The backend omits the LoraLoader node
   * from the built-in workflow when this is empty.
   */
  lora: string;
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
 * screens: loads sampler/scheduler/model/workflow lists, tracks the selected
 * workflow's template, subscribes to comfy progress/error events, and runs a
 * generation (building params, decoding images, surfacing toasts).
 *
 * Built-in split workflows (Krea 2 Turbo, Z-Image Turbo) carry `split` hints:
 * for those the model selection means a UNet file rather than a checkpoint,
 * plus a standalone text encoder and a mandatory VAE. Switching to a split
 * workflow preselects all three from the server lists by hint; switching back
 * restores the checkpoint default.
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
  const [unets, setUnets] = useState<string[]>([]);
  const [clips, setClips] = useState<string[]>([]);
  const [vaes, setVaes] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState(initialCheckpoint);
  // '' means "use the checkpoint's baked encoder" / "baked VAE" / "no LoRA".
  const [clip, setClip] = useState('');
  const [vae, setVae] = useState('');
  const [lora, setLora] = useState('');
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
    GetComfyUNets().then(setUnets).catch(() => {});
    GetComfyCLIPs().then(setClips).catch(() => {});
    GetComfyVAEs().then(setVaes).catch(() => {});
    GetComfyLoRAs().then(setLoras).catch(() => {});
  }, []);

  useEffect(() => {
    GetComfyWorkflows().then(wfs => setUploadedWorkflows(mapWorkflows(wfs))).catch(() => {});
  }, []);

  useEffect(() => {
    GetComfyWorkflowTemplate(workflowId).then(setWorkflowTemplate).catch(() => {});
  }, [workflowId]);

  // Only built-in presets can be split workflows; uploaded workflows carry
  // their own model files inside their JSON.
  const splitHints = workflowDefaults.find(w => w.id === workflowId)?.split;

  // Re-preselect the model files when the selected workflow's kind changes
  // (or the server lists arrive). Non-split → non-split switches leave the
  // user's picks alone; entering a split workflow stashes the current
  // checkpoint and preselects by hint; leaving one restores the stashed
  // selection, since the split selections may point at files a plain
  // checkpoint graph cannot load — and the first list entry is an arbitrary
  // (alphabetical) file that may not even carry a baked text encoder.
  const wasSplitRef = useRef(false);
  const stashedCheckpointRef = useRef('');
  useEffect(() => {
    const wasSplit = wasSplitRef.current;
    wasSplitRef.current = !!splitHints;
    // Deliberate prop→state sync, same pattern as useFieldEditor: the
    // selections track the selected workflow's kind.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (splitHints) {
      if (!wasSplit) stashedCheckpointRef.current = checkpoint;
      // Community Krea 2 / Z-Image models also ship as all-in-one
      // checkpoints, so the hint searches both lists — official split files
      // first. A checkpoint carries its own encoder and VAE.
      const model = pickByHint([...unets, ...checkpoints], splitHints.model);
      const isUnet = unets.includes(model);
      setCheckpoint(model);
      setClip(isUnet ? pickByHint(clips, splitHints.clip) : '');
      setVae(isUnet ? pickByHint(vaes, splitHints.vae) : '');
    } else if (wasSplit) {
      setCheckpoint(stashedCheckpointRef.current || checkpoints[0] || initialCheckpoint);
      setClip('');
      setVae('');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // initialCheckpoint is a per-screen constant, and checkpoint is only read
    // to stash it at the moment of entering a split workflow — re-running on
    // every selection change would clobber the stash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitHints, unets, clips, vaes, checkpoints]);

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

  const clearVariants = useCallback(() => { setVariantImages([]); setSelectedVariant(0); }, []);
  const stop = useCallback(() => setGenerating(false), []);

  const runGeneration = useCallback(async (req: GenerationRequest) => {
    if (generating) return;
    if (!workflowTemplate) {
      toast({ kind: 'warn', title: 'Loading', body: 'Workflow template not ready yet. Try again in a moment.' });
      return;
    }
    // A checkpoint selection carries a baked encoder and VAE; only the
    // official split files need explicit text-encoder and VAE picks.
    const usesUnet = !!splitHints && unets.includes(req.checkpoint);
    if (splitHints) {
      const missing = [
        !req.checkpoint && 'a model',
        usesUnet && !req.clip && 'a text encoder',
        usesUnet && !req.vae && 'a VAE',
      ].filter(Boolean).join(', ');
      if (missing) {
        toast({
          kind: 'warn',
          title: 'Missing model selection',
          body: `Pick ${missing} in the Models section before generating.`,
        });
        return;
      }
    }
    setGenerating(true);
    setProgress(0);
    setVariantImages([]);
    setSelectedVariant(0);

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
        modelKind: usesUnet ? 'unet' : 'checkpoint',
        clip: req.clip,
        vae: req.vae,
        lora: req.lora,
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
  }, [generating, workflowTemplate, splitHints, unets, generate, completionBody, toast]);

  return {
    samplers,
    schedulers,
    checkpoints,
    unets,
    clips,
    vaes,
    loras,
    checkpoint,
    setCheckpoint,
    clip,
    setClip,
    vae,
    setVae,
    lora,
    setLora,
    /** True when the selected workflow loads split model files. */
    splitWorkflow: !!splitHints,
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
