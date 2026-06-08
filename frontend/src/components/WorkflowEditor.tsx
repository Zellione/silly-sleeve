import React, { useState, useMemo, useCallback } from 'react';
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
}

const PLACEHOLDER_RE_SRC = /\{\{(\w+)\}\}/g;

const KNOWN_PLACEHOLDERS: Record<string, string> = {
  seed: 'Generation seed (integer)',
  steps: 'Sampling steps',
  cfg: 'CFG scale',
  sampler: 'Sampler name (e.g. euler, dpmpp_2m_karras)',
  scheduler: 'Scheduler (e.g. karras, normal)',
  positive_prompt: 'Positive prompt text',
  negative_prompt: 'Negative prompt text',
  width: 'Image width',
  height: 'Image height',
  model: 'Checkpoint / model name',
  checkpoint: 'Checkpoint / model name',
  ckpt_name: 'Checkpoint filename',
  denoise: 'Denoising strength',
  batch_size: 'Number of images per batch',
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

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, onClose }) => {
  const initialTemplate = useMemo(
    () => bytesToTemplateString(workflow.template) || bytesToTemplateString(workflow.jsonData),
    [workflow.template, workflow.jsonData],
  );

  const [jsonText, setJsonText] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);

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
    setJsonText(prev => prev + `{{${name}}}`);
  }, []);

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
      onClose();
    } catch {
      // error silently
    } finally {
      setSaving(false);
    }
  }, [jsonText, workflow.id, onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation" /* v8 ignore next */ onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="modal-panel workflow-editor-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 960, maxHeight: '80vh' }}
        role="dialog" aria-modal="true" /* v8 ignore next */ onKeyDown={e => { if (e.key === 'Escape') onClose(); e.stopPropagation(); }}>
        <div className="modal-head">
          <b>Edit Workflow: {workflow.name}.json</b>
          <button className="btn ghost icon" onClick={onClose}><XIcon size={14} /></button>
        </div>
        <div className="workflow-editor-body">
          <div className="workflow-editor-left">
            <div className="workflow-editor-toolbar">
              <button className="btn ghost sm" onClick={handleFormat}>Format JSON</button>
            </div>
            <textarea
              className="field workflow-editor-textarea"
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              spellCheck={false}
              style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, lineHeight: 1.5, minHeight: 400, resize: 'vertical' }}
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
