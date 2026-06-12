import React, { type ReactNode } from 'react';
import { XIcon, ArrowIcon, SaveIcon } from '../icons';

interface ImageCanvasPanelProps {
  canvasTitle: string;
  workflowSize: string;
  seed: number;

  generating: boolean;
  progress: number;
  steps: number;
  showDonePlaceholder: boolean;

  idlePlaceholder: ReactNode;
  donePlaceholder?: ReactNode;

  showAutoFill?: boolean;
  autoFillButton: ReactNode;

  prompt: string;
  onPromptChange: (v: string) => void;
  negPrompt: string;
  onNegPromptChange: (v: string) => void;

  onToggleGenerate: () => void;
  onSavePreset?: () => void;
}

const ImageCanvasPanel: React.FC<ImageCanvasPanelProps> = ({
  canvasTitle, workflowSize, seed,
  generating, progress, steps, showDonePlaceholder,
  idlePlaceholder, donePlaceholder,
  showAutoFill = true, autoFillButton,
  prompt, onPromptChange, negPrompt, onNegPromptChange,
  onToggleGenerate, onSavePreset,
}) => {
  const stepLabel = `step ${Math.round(progress / 100 * steps)} / ${steps}`;

  return (
    <div className="img-col">
      <div className="img-col-head">
        <b>{generating ? 'Sampling…' : canvasTitle}</b>
        <span className="img-col-sub">{workflowSize} · seed {seed}</span>
      </div>
      <div className="img-canvas">
        {!generating && !showDonePlaceholder && idlePlaceholder}
        {!generating && showDonePlaceholder && donePlaceholder}
        {generating && (
          <div className="img-generating">
            <div className="img-progress-disc" />
            <div style={{ marginTop: 14, font: '500 11px/1 var(--f-mono)', color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              {stepLabel}
            </div>
            <div style={{ marginTop: 6, width: 160 }} className="bar"><i style={{ width: progress + '%' }} /></div>
          </div>
        )}
      </div>
      <div className="img-col-foot">
        <span className="uplabel">
          Positive prompt
          {showAutoFill && autoFillButton}
        </span>
        <textarea className="field" value={prompt} onChange={e => onPromptChange(e.target.value)}
          style={{ minHeight: 78, fontFamily: 'var(--f-mono)', fontSize: 11.5 }} />
        <span className="uplabel">Negative prompt</span>
        <textarea className="field" value={negPrompt} onChange={e => onNegPromptChange(e.target.value)}
          style={{ minHeight: 48, fontFamily: 'var(--f-mono)', fontSize: 11.5 }} />
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <button className="btn primary" onClick={onToggleGenerate} style={{ flex: 1, justifyContent: 'center' }}>
            {generating ? (
              <><XIcon size={12} /> Stop ({Math.round(progress)}%)</>
            ) : (
              <><ArrowIcon size={12} /> Queue generation</>
            )}
          </button>
          {onSavePreset && (
            <button className="btn ghost icon" title="Save preset" onClick={onSavePreset}><SaveIcon size={14} /></button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCanvasPanel;
