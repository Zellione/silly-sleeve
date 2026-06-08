import React, { useState, useMemo, useCallback, useRef } from 'react';
import { SaveComfyWorkflowTemplate } from '../../wailsjs/go/main/App';
import { XIcon } from '../icons';

interface WorkflowEditorProps {
  workflow: {
    id: string;
    name: string;
    jsonData: number[] | null;
    template: number[] | null;
  };
  onClose: () => void;
  onSaved?: (bytes: number[]) => void;
  onSaveError?: (msg: string) => void;
}

const PLACEHOLDER_RE_SRC = /\{\{(\w+)\}\}/g;

const KNOWN_PLACEHOLDERS: Record<string, string> = {
  seed: 'Generation seed (integer)',
  steps: 'Sampling steps',
  cfg: 'CFG scale',
  sampler: 'Sampler name',
  scheduler: 'Scheduler name',
  positive_prompt: 'Positive prompt text',
  negative_prompt: 'Negative prompt text',
  width: 'Image width',
  height: 'Image height',
  model: 'Checkpoint/model name',
  checkpoint: 'Checkpoint/model name',
  ckpt_name: 'Checkpoint filename',
  denoise: 'Denoising strength',
  batch_size: 'Images per batch',
};

function bytesToTemplateString(bytes: number[] | null | undefined): string {
  if (!bytes || bytes.length === 0) return '';
  try {
    const decoder = new TextDecoder();
    return JSON.stringify(JSON.parse(decoder.decode(new Uint8Array(bytes))), null, 2);
  } catch {
    return '';
  }
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, onClose, onSaved, onSaveError }) => {
  const initialTemplate = useMemo(
    () => bytesToTemplateString(workflow.template) || bytesToTemplateString(workflow.jsonData),
    [workflow.template, workflow.jsonData],
  );

  const [jsonText, setJsonText] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholders = useMemo(() => {
    const names = new Set<string>();
    const re = new RegExp(PLACEHOLDER_RE_SRC);
    let match: RegExpExecArray | null;
    while ((match = re.exec(jsonText)) !== null) {
      names.add(match[1]);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [jsonText]);

  const handleInsertPlaceholder = useCallback((name: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = jsonText.slice(0, start);
    const after = jsonText.slice(end);
    const replacement = `{{${name}}}`;
    setJsonText(`${before}${replacement}${after}`);
    /* v8 ignore start */
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + replacement.length;
      el.setSelectionRange(pos, pos);
    });
    /* v8 ignore stop */
  }, [jsonText]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
    } catch {
      // keep current text if not valid JSON
    }
  }, [jsonText]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const encoder = new TextEncoder();
      const bytes = Array.from(encoder.encode(jsonText));
      await SaveComfyWorkflowTemplate(workflow.id, bytes);
      onSaved?.(bytes);
      onClose();
    } catch (e: any) {
      onSaveError?.(e?.message || 'Could not save workflow template.');
    } finally {
      setSaving(false);
    }
  }, [jsonText, workflow.id, onClose, onSaved, onSaveError]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleBackdropKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const displayName = workflow.name.replace(/\.json$/i, '');

  return (
    <div
      className="workflow-editor-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit Workflow: ${displayName}`}
      tabIndex={-1}
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKey}
    >
      <div className="workflow-editor-card">
        <div className="modal-head">
          <b>Edit Workflow: {displayName}.json</b>
          <button className="btn ghost icon" aria-label="Close" onClick={onClose}><XIcon size={14} /></button>
        </div>
        <div className="workflow-editor-body">
          <div className="workflow-editor-left">
            <div className="workflow-editor-toolbar">
              <button className="btn ghost sm" onClick={handleFormat}>Format JSON</button>
            </div>
            <textarea
              ref={textareaRef}
              className="field workflow-editor-textarea"
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              spellCheck={false}
              style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, lineHeight: 1.5, minHeight: 200, resize: 'vertical' }}
            />
          </div>
          <div className="workflow-editor-right">
            <span className="uplabel">Placeholders ({placeholders.length})</span>
            <div className="workflow-placeholder-list">
              {placeholders.map(name => (
                <button key={name} className="btn ghost sm workflow-placeholder-chip"
                  onClick={() => handleInsertPlaceholder(name)}
                  title={KNOWN_PLACEHOLDERS[name] || `Custom placeholder: ${name}`}>
                  <span className="mono" style={{ fontSize: 10 }}>{`{{${name}}}`}</span>
                  <span className="helpr" style={{ fontSize: 9.5, flex: 1 }}>
                    {KNOWN_PLACEHOLDERS[name] || 'Custom placeholder'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--acc)' }}>Insert</span>
                </button>
              ))}
            </div>
            <div className="img-divline" />
            <span className="uplabel">Available placeholders</span>
            <div className="workflow-placeholder-list">
              {Object.keys(KNOWN_PLACEHOLDERS).filter(name => !placeholders.includes(name)).map(name => (
                <button key={name} className="btn ghost sm workflow-placeholder-chip"
                  onClick={() => handleInsertPlaceholder(name)}
                  title={KNOWN_PLACEHOLDERS[name]}>
                  <span className="mono" style={{ fontSize: 10, opacity: 0.5 }}>{`{{${name}}}`}</span>
                  <span className="helpr" style={{ fontSize: 9.5, opacity: 0.5, flex: 1 }}>
                    {KNOWN_PLACEHOLDERS[name]}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Insert</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditor;
