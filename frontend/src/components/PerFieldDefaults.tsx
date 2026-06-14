import React from 'react';
import type { settings } from '../../wailsjs/go/models';
import { SLOTS } from '../utils/fieldEndpoints';
import { Dropdown } from './Dropdown';

export interface PerFieldDefaultsProps {
  endpoints: settings.LLMEndpoint[];
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

/** Settings table: a global default endpoint per generation slot. */
export const PerFieldDefaults: React.FC<PerFieldDefaultsProps> = ({ endpoints, value, onChange }) => {
  if (endpoints.length === 0) {
    return <p className="desc">Add an LLM endpoint above to assign per-field defaults.</p>;
  }

  const setSlot = (slot: string, raw: string) => {
    const id = Number(raw);
    const next = { ...value };
    if (id <= 0) delete next[slot];
    else next[slot] = id;
    onChange(next);
  };

  return (
    <div className="per-field-defaults">
      {SLOTS.map(slot => (
        <div key={slot.id} className="pfd-row">
          <span className="pfd-label">{slot.label}</span>
          <Dropdown
            aria-label={`Endpoint for ${slot.label}`}
            value={String(value[slot.id] ?? 0)}
            onChange={raw => setSlot(slot.id, raw)}
            style={{ minWidth: 200 }}
            options={[
              { value: '0', label: 'Use default endpoint' },
              ...endpoints.map(ep => ({ value: String(ep.id), label: ep.name })),
            ]}
          />
        </div>
      ))}
    </div>
  );
};
