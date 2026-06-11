import React, { useState } from 'react';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  SparksIcon, UploadIcon, CheckIcon, ImageIcon,
} from '../icons';
import { GenerateProjectImage } from '../../wailsjs/go/main/App';
import ImageUploadPanel from '../components/ImageUploadPanel';
import GenerationParamsPanel from '../components/GenerationParamsPanel';
import ImageCanvasPanel from '../components/ImageCanvasPanel';
import ImageGalleryPanel from '../components/ImageGalleryPanel';
import { useImageGeneration } from '../components/useImageGeneration';
import { aspectFromSize } from '../utils/workflow';

const PROJECT_IMG_WORKFLOWS = [
  { id: 'sdxl_cover', name: 'cover_sdxl_v2', model: 'sd_xl_base_1.0', size: '1344×768', steps: 26, sampler: 'dpmpp_2m', scheduler: 'karras' },
  { id: 'flux_banner', name: 'flux_banner', model: 'flux1-dev-fp8', size: '1216×832', steps: 20, sampler: 'euler', scheduler: 'normal' },
  { id: 'painterly', name: 'painterly_square', model: 'juggernautXL_v9', size: '1024×1024', steps: 30, sampler: 'dpmpp_2m', scheduler: 'karras' },
];

const ProjectImageScreen: React.FC = () => {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const [workflow, setWorkflow] = useState(PROJECT_IMG_WORKFLOWS[0]);
  const [steps, setSteps] = useState(26);
  const [cfg, setCfg] = useState(7);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 4e9));
  const [sampler, setSampler] = useState('dpmpp_2m');
  const [scheduler, setScheduler] = useState('karras');
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const { toast } = useToast();

  const {
    samplers, schedulers, checkpoints, checkpoint, setCheckpoint, allWorkflows,
    generating, progress, variantImages, selectedVariant, setSelectedVariant,
    clearVariants, stop, runGeneration,
  } = useImageGeneration({
    workflowId: workflow.id,
    workflowDefaults: PROJECT_IMG_WORKFLOWS,
    generate: GenerateProjectImage,
    completionBody: n => `${n} cover variants ready.`,
    initialCheckpoint: PROJECT_IMG_WORKFLOWS[0].model,
  });

  const handleUseAsProjectImage = () => {
    toast({ kind: 'ok', title: 'Project image set', body: 'Cover art saved and will appear in exports.' });
  };

  const canvasTitle = 'Project cover';
  const showDonePlaceholder = variantImages.length > 0;

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
              workflows={allWorkflows}
              selectedWorkflow={workflow}
              onWorkflowChange={w => { setWorkflow(w); setSteps(w.steps); setSampler(w.sampler); setScheduler(w.scheduler); setCheckpoint(w.model); }}
              steps={steps} onStepsChange={setSteps}
              cfg={cfg} onCfgChange={setCfg}
              denoise={1} onDenoiseChange={() => {}}
              sampler={sampler} onSamplerChange={setSampler}
              scheduler={scheduler} onSchedulerChange={setScheduler}
              seed={seed} onSeedChange={setSeed}
              showDenoise={false}
              showAspectSelector
              samplerList={samplers}
              schedulerList={schedulers}
            >
              <span className="uplabel">Checkpoint</span>
              <div className="img-kv" style={{ marginBottom: 10 }}>
                <select id="proj-checkpoint" style={{ width: 'auto' }} value={checkpoint}
                  onChange={e => { setCheckpoint(e.target.value); e.target.blur(); }}>
                  {(checkpoints.length > 0 ? checkpoints : [PROJECT_IMG_WORKFLOWS[0].model, PROJECT_IMG_WORKFLOWS[1].model, PROJECT_IMG_WORKFLOWS[2].model]).map(c => (
                    <option key={c} value={c}>{c.replace(/\.safetensors$/, '')}</option>
                  ))}
                </select>
              </div>
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
              aspectRatio={aspectFromSize(workflow.size)}
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
                variantImages.length > 0 && variantImages[selectedVariant] ? (
                  <div className="img-placeholder proj-cover-shot" style={{ overflow: 'hidden' }}>
                    <img src={variantImages[selectedVariant]} alt={`cover variant ${selectedVariant + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div className="img-placeholder proj-cover-shot">
                    <div className="proj-cover-name">Project Name</div>
                    <div className="proj-cover-sub">cover art · {workflow.size}</div>
                  </div>
                )
              }
              showAutoFill={true}
              autoFillButton={
                <button className="img-auto-fill" onClick={() => toast({ kind: 'info', title: 'Auto-fill', body: 'Prompt will auto-fill from lorebook context when generation is queued.' })}>
                  <SparksIcon size={10} style={{ verticalAlign: -1 }} /> auto-fill from lorebook
                </button>
              }
              prompt={prompt}
              onPromptChange={setPrompt}
              negPrompt={negPrompt}
              onNegPromptChange={setNegPrompt}
              onToggleGenerate={generating ? stop : () => runGeneration({ size: workflow.size, seed, steps, cfg, sampler, scheduler, denoise: 1, prompt, negPrompt, checkpoint })}
              onSavePreset={() => {}}
            />

            <ImageGalleryPanel
              headLabel="Versions"
              variantCount={variantImages.length}
              onClear={clearVariants}
              galleryContent={
                <div className="proj-img-versions">
                  {variantImages.map((imgUrl, i) => (
                    <button key={`${seed}-${i}`} className={`proj-img-version${selectedVariant === i ? ' on' : ''}`}
                      onClick={() => setSelectedVariant(i)}>
                      <div className="proj-version-thumb" style={{ overflow: 'hidden' }}>
                        <img src={imgUrl} alt={`variant ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div className="proj-version-meta">
                        <b>v{i + 1}</b>
                        <span>{(seed + i).toString().slice(-7)} · cfg {(cfg + i * 0.5).toFixed(1)}</span>
                      </div>
                      {selectedVariant === i && <CheckIcon size={13} style={{ color: 'var(--acc)' }} />}
                    </button>
                  ))}
                </div>
              }
              showMetadata={variantImages.length > 0}
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
              useImageDisabled={variantImages.length === 0}
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
