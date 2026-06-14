import React from 'react';
import type { settings } from '../../wailsjs/go/models';
import { resolveEndpoint } from '../utils/fieldEndpoints';

export interface FieldEndpointChipProps {
  slot: string;
  label: string;
  endpoints: settings.LLMEndpoint[];
  globalMap: Record<string, number>;
  projectMap: Record<string, number>;
  onSelect: (slot: string, endpointID: number) => void;
}

/** Inline endpoint selector for one slot; reflects the effective endpoint. */
export const FieldEndpointChip: React.FC<FieldEndpointChipProps> = ({
  slot, label, endpoints, globalMap, projectMap, onSelect,
}) => {
  if (endpoints.length === 0) return null;
  const { source } = resolveEndpoint(slot, endpoints, globalMap, projectMap);
  const projectValue = projectMap[slot] ?? 0;

  return (
    <select
      className="field-endpoint-chip"
      data-source={source}
      aria-label={`Endpoint for ${label}`}
      title={`Endpoint (${source})`}
      value={projectValue}
      onChange={e => onSelect(slot, Number(e.target.value))}
    >
      <option value={0}>Use default</option>
      {endpoints.map(ep => (
        <option key={ep.id} value={ep.id}>{ep.name}</option>
      ))}
    </select>
  );
};
