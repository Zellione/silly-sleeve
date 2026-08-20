import React, { useEffect, useState } from 'react';
import { CheckIcon } from '../../icons';
import { useToast } from '../ToastProvider';
import { useConfirmDialog } from '../ConfirmDialog';
import { GetPromptTemplates, GetDefaultPromptTemplates, SavePromptTemplates } from '../../../wailsjs/go/app/App';
import { prompts } from '../../../wailsjs/go/models';
import { errorMessage } from '../../utils/errorMessage';

// eslint-disable-next-line react-refresh/only-export-components
export const FIELD_IDS = ['name', 'epithet', 'tags', 'appearance', 'personality', 'backstory', 'abilities', 'relationships', 'quotes', 'stats'];
// eslint-disable-next-line react-refresh/only-export-components
export const FIELD_LABELS: Record<string, string> = {
  name: 'Name', epithet: 'Title / epithet', tags: 'Tags', appearance: 'Appearance',
  personality: 'Personality', backstory: 'Backstory', abilities: 'Abilities & skills',
  relationships: 'Relationships', quotes: 'Example quotes', stats: 'Stat block',
};
// eslint-disable-next-line react-refresh/only-export-components
export const VARIABLES = ['crawl_context', 'crawl.title', 'crawl.url', 'character.name', 'custom'];
// eslint-disable-next-line react-refresh/only-export-components
export const VARIABLE_LABELS: Record<string, string> = {
  'crawl_context': 'Full crawl text',
  'crawl.title': 'Wiki page title',
  'crawl.url': 'Wiki page URL',
  'character.name': 'Character name',
  'custom': 'Custom instruction',
};

export type PromptTemplateEditorProps = Readonly<Record<string, never>>;

export const PromptTemplateEditor: React.FC<PromptTemplateEditorProps> = () => {
  const [templates, setTemplates] = useState<prompts.TemplateSet | null>(null);
  const [activeField, setActiveField] = useState<string>('bulk');
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    GetPromptTemplates().then(t => {
      setTemplates(t);
      setDraft(t.systemPrompt);
    }).catch(() => {
      toast({ kind: 'bad', title: 'Load failed', body: 'Could not load prompt templates.' });
    });
  }, [toast]);

  const handleFieldSelect = async (fieldId: string) => {
    if (dirty && !(await confirm('You have unsaved changes. Discard them?'))) return;
    setActiveField(fieldId);
    if (!templates) return;
    if (fieldId === 'bulk') {
      setDraft(templates.systemPrompt);
    } else {
      setDraft(templates.fieldPrompts?.[fieldId] || '');
    }
    setDirty(false);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!templates) return;
    const next = prompts.TemplateSet.createFrom({
      systemPrompt: templates.systemPrompt,
      fieldPrompts: { ...templates.fieldPrompts },
    });
    if (activeField === 'bulk') {
      next.systemPrompt = draft;
    } else {
      next.fieldPrompts[activeField] = draft;
    }
    try {
      await SavePromptTemplates(next);
      setTemplates(next);
      setDirty(false);
      toast({ kind: 'ok', title: 'Templates saved', body: activeField === 'bulk' ? 'Bulk system prompt updated.' : `${FIELD_LABELS[activeField] || activeField} template updated.` });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Save failed', body: errorMessage(e, 'Could not save prompt templates.') });
    }
  };

  const handleResetField = async () => {
    if (!(await confirm('Reset to default? This cannot be undone.'))) return;
    if (!templates) return;
    try {
      const defaults = await GetDefaultPromptTemplates();
      const next = prompts.TemplateSet.createFrom({
        systemPrompt: templates.systemPrompt,
        fieldPrompts: { ...templates.fieldPrompts },
      });
      if (activeField === 'bulk') {
        next.systemPrompt = defaults.systemPrompt;
        setDraft(defaults.systemPrompt);
      } else {
        next.fieldPrompts[activeField] = defaults.fieldPrompts[activeField] || '';
        setDraft(defaults.fieldPrompts?.[activeField] || '');
      }
      await SavePromptTemplates(next);
      setTemplates(next);
      setDirty(false);
      toast({ kind: 'ok', title: 'Reset to default', body: activeField === 'bulk' ? 'Bulk system prompt reset to default and saved.' : `${FIELD_LABELS[activeField] || activeField} template reset to default and saved.` });
    } catch (e: any) {
      toast({ kind: 'bad', title: 'Reset failed', body: errorMessage(e, 'Could not reset to defaults.') });
    }
  };

  const insertVariable = (v: string) => {
    setDraft(prev => prev + `{{${v}}}`);
    setDirty(true);
  };

  if (!templates) {
    return (
      <div className="settings-section">
        <h3>Prompt templates</h3>
        <div className="shimmer" style={{ width: 200, height: 16 }} />
      </div>
    );
  }

  const tokenEst = Math.round(draft.length / 4);
  const activeLabel = activeField === 'bulk' ? 'Bulk generation (system prompt)' : (FIELD_LABELS[activeField] || activeField);

  return (
    <div className="settings-section">
      <h3>Prompt templates</h3>
      <p className="desc">
        Customise the prompts sent to the LLM for bulk generation and per-field rerolls. Use variable chips to inject crawl context, character data, or custom instructions.
      </p>

      <div className="prompt-templates-editor">
        <nav className="prompt-field-nav">
          <button
            type="button"
            data-on={activeField === 'bulk' ? '1' : '0'}
            onClick={() => handleFieldSelect('bulk')}
          >
            Bulk system
          </button>
          {FIELD_IDS.map(id => (
            <button
              type="button"
              key={id}
              data-on={activeField === id ? '1' : '0'}
              onClick={() => handleFieldSelect(id)}
            >
              {FIELD_LABELS[id] || id}
            </button>
          ))}
        </nav>

        <div className="prompt-editor-body">
          <div className="prompt-editor-header">
            <span className="uplabel">{activeLabel}</span>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={handleResetField}>
                Reset to default
              </button>
              <button type="button" className="btn primary sm" disabled={!dirty} onClick={handleSave}>
                {dirty ? <><CheckIcon size={12} /> Save</> : 'Saved'}
              </button>
            </div>
          </div>

          <textarea
            className="prompt-textarea"
            value={draft}
            onChange={e => handleDraftChange(e.target.value)}
            placeholder="Write your prompt template…"
            spellCheck={false}
          />

          <div className="prompt-variables">
            <span className="uplabel">Insert variable:</span>
            <div className="var-chips">
              {VARIABLES.map(v => (
                <button type="button" key={v} className="var-chip" onClick={() => insertVariable(v)} title={VARIABLE_LABELS[v] || v}>
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="prompt-footer">
            <span>{draft.length} chars · ~{tokenEst} tokens</span>
            {dirty && <span className="hint" style={{ color: 'var(--acc-ink)' }}>Unsaved changes</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
