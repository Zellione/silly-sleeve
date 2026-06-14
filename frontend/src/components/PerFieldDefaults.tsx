import React from 'react';
import type { settings } from '../../wailsjs/go/models';
import { SLOTS } from '../utils/fieldEndpoints';

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
          <select
            aria-label={`Endpoint for ${slot.label}`}
            value={value[slot.id] ?? 0}
            onChange={e => setSlot(slot.id, e.target.value)}
          >
            <option value={0}>Use default endpoint</option>
            {endpoints.map(ep => (
              <option key={ep.id} value={ep.id}>{ep.name}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};
