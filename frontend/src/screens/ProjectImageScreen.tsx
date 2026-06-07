import React, { useState, useRef } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  SparksIcon, UploadIcon, CheckIcon, ImageIcon,
} from '../icons';
import ImageUploadPanel from '../components/ImageUploadPanel';
import GenerationParamsPanel from '../components/GenerationParamsPanel';
import ImageCanvasPanel from '../components/ImageCanvasPanel';
import ImageGalleryPanel from '../components/ImageGalleryPanel';

const PROJECT_IMG_WORKFLOWS = [
  { id: 'sdxl_cover', name: 'cover_sdxl_v2', model: 'sd_xl_base_1.0', size: '1344×768', steps: 26, sampler: 'dpmpp_2m_karras' },
  { id: 'flux_banner', name: 'flux_banner', model: 'flux1-dev-fp8', size: '1216×832', steps: 20, sampler: 'euler' },
  { id: 'painterly', name: 'painterly_square', model: 'juggernautXL_v9', size: '1024×1024', steps: 30, sampler: 'dpmpp_2m_karras' },
];

const ProjectImageScreen: React.FC = () => {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const [workflow, setWorkflow] = useState(PROJECT_IMG_WORKFLOWS[0]);
  const [steps, setSteps] = useState(26);
  const [cfg, setCfg] = useState(7);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 4e9));
  const [sampler, setSampler] = useState('dpmpp_2m_karras');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [variants, setVariants] = useState<number[]>([]);
  const [hasImage, setHasImage] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const generationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const generateVariants = () => {
    if (generating) return;
    /* v8 ignore start */
    setGenerating(true);
    setProgress(0);
    const newVariants: number[] = [];
    const seeds = [seed, seed + 1, seed + 2];

    let currentVariant = 0;
    generationRef.current = setInterval(() => {
      if (currentVariant >= 3) {
        const ref = generationRef.current;
        if (ref !== null) clearInterval(ref);
        generationRef.current = null;
        setGenerating(false);
        setProgress(100);
        setHasImage(true);
        toast({ kind: 'ok', title: 'Generation complete', body: '3 cover variants ready.' });
        return;
      }

      const variantProgress = Math.min(100, Math.max(0,
        ((currentVariant / 3) * 100) + (Math.random() * 30)
      ));

      if (variantProgress >= (currentVariant + 1) / 3 * 100) {
        newVariants.push(seeds[currentVariant]);
        setVariants([...newVariants]);
        currentVariant++;
      }

      setProgress(variantProgress);
    }, 180);
    /* v8 ignore stop */
  };

  const handleStop = () => {
    /* v8 ignore start */
    if (generationRef.current) {
      clearInterval(generationRef.current);
      generationRef.current = null;
    }
    setGenerating(false);
    /* v8 ignore stop */
  };

  const handleUseAsProjectImage = () => {
    toast({ kind: 'ok', title: 'Project image set', body: 'Cover art saved and will appear in exports.' });
  };

  const canvasTitle = 'Project cover';
  const showDonePlaceholder = hasImage;

  return (
    <>
      <PageHead step={4} subtitle="Cover art for the whole project"
        title={<>Project <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>image</em></>}
        actions={
            <div style={{ width: 240 }} className="img-tabs">
              <button data-on={mode === 'generate' ? '1' : '0'} onClick={() => setMode('generate')}>
                <SparksIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Generate
              </button>
              <button data-on={mode === 'upload' ? '1' : '0'} onClick={() => setMode('upload')}>
                <UploadIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Upload
              </button>
            </div>
        } />

      <div className="ss-page-body scroll">
        {mode === 'generate' ? (
          <div className="proj-img-grid">
            <GenerationParamsPanel
              aria-label="Project image generation parameters"
              workflows={PROJECT_IMG_WORKFLOWS}
              selectedWorkflow={workflow}
              onWorkflowChange={w => { setWorkflow(w); setSteps(w.steps); setSampler(w.sampler); }}
              steps={steps} onStepsChange={setSteps}
              cfg={cfg} onCfgChange={setCfg}
              denoise={1} onDenoiseChange={() => {}}
              sampler={sampler} onSamplerChange={setSampler}
              scheduler="normal" onSchedulerChange={() => {}}
              seed={seed} onSeedChange={setSeed}
              showDenoise={false}
              showAspectSelector
            >
              <span className="uplabel">Use project context</span>
              <div className="col" style={{ gap: 6 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--acc)' }} />
                  <span>Mood from lorebook entries</span>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--acc)' }} />
                  <span>Setting from &ldquo;World&rdquo; entry</span>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: 'var(--acc)' }} />
                  <span>Cameo characters in scene</span>
                </label>
              </div>
            </GenerationParamsPanel>

            <ImageCanvasPanel
              canvasTitle={canvasTitle}
              workflowSize={workflow.size}
              seed={seed}
              aspectRatio="16/9"
              generating={generating}
              progress={progress}
              steps={steps}
              showDonePlaceholder={showDonePlaceholder}
              idlePlaceholder={
                <div className="img-placeholder">
                  <ImageIcon size={32} style={{ opacity: 0.4 }} />
                  <div style={{ marginTop: 10 }}>project cover</div>
                  <div style={{ fontSize: 10.5, opacity: 0.6, marginTop: 4 }}>press generate</div>
                </div>
              }
              donePlaceholder={
                <div className="img-placeholder proj-cover-shot">
                  <div className="proj-cover-name">Project Name</div>
                  <div className="proj-cover-sub">cover art · {workflow.size}</div>
                </div>
              }
              autoFillButton={
                <button className="img-auto-fill" onClick={() => toast({ kind: 'info', title: 'Auto-fill', body: 'Prompt will auto-fill from lorebook context when generation is queued.' })}>
                  <SparksIcon size={10} style={{ verticalAlign: -1 }} /> auto-fill from lorebook
                </button>
              }
              prompt={prompt}
              onPromptChange={setPrompt}
              negPrompt={negPrompt}
              onNegPromptChange={setNegPrompt}
              onToggleGenerate={generating ? handleStop : generateVariants}
              onSavePreset={() => {}}
            />

            <ImageGalleryPanel
              headLabel="Versions"
              variantCount={variants.length}
              onClear={() => { setVariants([]); setHasImage(false); }}
              galleryContent={
                <div className="proj-img-versions">
                  {variants.map((variantSeed, i) => (
                    <button key={variantSeed} className={`proj-img-version${selectedVariant === i ? ' on' : ''}`}
                      onClick={() => setSelectedVariant(i)}>
                      <div className="proj-version-thumb" />
                      <div className="proj-version-meta">
                        <b>v{i + 1}</b>
                        <span>{(variantSeed).toString().slice(-7)} · cfg {(cfg + i * 0.5).toFixed(1)}</span>
                      </div>
                      {selectedVariant === i && <CheckIcon size={13} style={{ color: 'var(--acc)' }} />}
                    </button>
                  ))}
                </div>
              }
              showMetadata={variants.length > 0}
              selectedLabel={`Selected · v${selectedVariant + 1}`}
              metadataItems={[
                { label: 'Seed', value: String(seed + selectedVariant) },
                { label: 'Steps', value: String(steps) },
                { label: 'Workflow', value: workflow.name },
                { label: 'Size', value: workflow.size },
              ]}
              rerollLabel="Re-roll variants"
              downloadLabel="Save PNG only"
              useImageLabel="Use as project image"
              onUseImage={handleUseAsProjectImage}
              useImageDisabled={variants.length === 0}
            />
          </div>
        ) : (
          <ImageUploadPanel
            aspectRatio="16/9"
            dropText="Drop a cover image here"
            recommendedSize="PNG, JPG, WEBP · up to 16 MB"
            maxSize="Recommended 1920 × 1080 (16:9) or 1024 × 1024 (square)"
            defaultCrop="Center 16:9"
            defaultResize="Fit to 1920×1080"
            onUseImage={handleUseAsProjectImage}
          />
        )}
      </div>
    </>
  );
};

export default ProjectImageScreen;
