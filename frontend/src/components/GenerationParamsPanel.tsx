import React, { useId } from 'react';
import { DiceIcon } from '../icons';
import { Dropdown } from './Dropdown';

export interface WorkflowOption {
  id: string;
  name: string;
  model: string;
  size: string;
  steps: number;
  sampler: string;
  scheduler: string;
}

interface GenerationParamsPanelProps {
  workflows: WorkflowOption[];
  selectedWorkflow: WorkflowOption;
  onWorkflowChange: (w: WorkflowOption) => void;
  steps: number;
  onStepsChange: (n: number) => void;
  cfg: number;
  onCfgChange: (n: number) => void;
  denoise: number;
  onDenoiseChange: (n: number) => void;
  sampler: string;
  onSamplerChange: (s: string) => void;
  scheduler: string;
  onSchedulerChange: (s: string) => void;
  seed: number;
  onSeedChange: (s: number) => void;
  showDenoise?: boolean;
  showAspectSelector?: boolean;
  samplerList?: string[];
  schedulerList?: string[];
  children?: React.ReactNode;
}

const GenerationParamsPanel: React.FC<GenerationParamsPanelProps> = ({
  workflows,
  selectedWorkflow,
  onWorkflowChange,
  steps,
  onStepsChange,
  cfg,
  onCfgChange,
  denoise,
  onDenoiseChange,
  sampler,
  onSamplerChange,
  scheduler,
  onSchedulerChange,
  seed,
  onSeedChange,
  showDenoise = true,
  showAspectSelector = false,
  samplerList,
  schedulerList,
  children,
}) => {
  const uid = useId();
  return (
    <div className="img-col">
      <div className="img-col-head"><b>Workflow</b></div>
      <div className="img-col-body scroll">
        <div className="workflow-pill">
          <div className="ic" style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>.json</div>
          <div>
            <b>{selectedWorkflow.name}.json</b>
            <span>{selectedWorkflow.model} · {selectedWorkflow.size}</span>
          </div>
        </div>
        <Dropdown
          className="as-mono"
          style={{ width: '100%' }}
          aria-label="Workflow"
          value={selectedWorkflow.id}
          onChange={raw => {
            const w = workflows.find(x => x.id === raw);
            if (w) onWorkflowChange(w);
          }}
          options={workflows.map(w => ({ value: w.id, label: `${w.name} — ${w.size}` }))}
        />

        <div className="img-divline" />
        <span className="uplabel">Sampler params</span>
        <div className="img-kv">
          <label htmlFor={`${uid}-steps`}>Steps</label>
          <input id={`${uid}-steps`} type="number" min={1} max={150} value={steps} onChange={e => onStepsChange(+e.target.value)} />
          <label htmlFor={`${uid}-cfg`}>CFG scale</label>
          <input id={`${uid}-cfg`} type="number" step={0.1} min={0} max={30} value={cfg} onChange={e => onCfgChange(+e.target.value)} />
          {showDenoise && (
            <>
              <label htmlFor={`${uid}-denoise`}>Denoise</label>
              <input id={`${uid}-denoise`} type="number" step={0.05} min={0} max={1} value={denoise} onChange={e => onDenoiseChange(+e.target.value)} />
            </>
          )}
          <label htmlFor={`${uid}-sampler`}>Sampler</label>
          <Dropdown
            id={`${uid}-sampler`}
            aria-label="Sampler"
            value={sampler}
            onChange={onSamplerChange}
            options={(samplerList && samplerList.length > 0 ? samplerList : ['dpmpp_2m', 'euler_ancestral', 'euler', 'dpmpp_2m_sde']).map(s => ({ value: s, label: s }))}
          />
          <label htmlFor={`${uid}-scheduler`}>Scheduler</label>
          <Dropdown
            id={`${uid}-scheduler`}
            aria-label="Scheduler"
            value={scheduler}
            onChange={onSchedulerChange}
            options={(schedulerList && schedulerList.length > 0 ? schedulerList : ['karras', 'normal', 'exponential', 'simple']).map(s => ({ value: s, label: s }))}
          />
          {showAspectSelector && (
            <>
              <label htmlFor={`${uid}-aspect`}>Aspect</label>
              <Dropdown
                id={`${uid}-aspect`}
                aria-label="Aspect"
                defaultValue="banner"
                options={[
                  { value: 'banner', label: 'Banner · 16:9' },
                  { value: 'cover', label: 'Cover · 3:2' },
                  { value: 'square', label: 'Square · 1:1' },
                ]}
              />
            </>
          )}
        </div>

        <div className="img-divline" />
        <span className="uplabel">Seed</span>
        <div className="row" style={{ gap: 6 }}>
          <input className="field" value={seed} onChange={e => onSeedChange(+e.target.value || 0)}
            style={{ flex: 1, fontSize: 12, fontFamily: 'var(--f-mono)' }} />
          <button className="btn ghost icon" title="Randomize" onClick={() => onSeedChange(Math.floor(Math.random() * 4e9))}>
            <DiceIcon size={14} />
          </button>
        </div>

        {children && (
          <>
            <div className="img-divline" />
            {children}
          </>
        )}
      </div>
    </div>
  );
};

export default GenerationParamsPanel;
