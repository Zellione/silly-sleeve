import React from 'react';
import type { settings } from '../../wailsjs/go/models';
import { resolveEndpoint } from '../utils/fieldEndpoints';
import { Dropdown } from './Dropdown';

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
    <Dropdown
      className="as-chip"
      data-source={source}
      aria-label={`Endpoint for ${label}`}
      title={`Endpoint (${source})`}
      value={String(projectValue)}
      onChange={raw => onSelect(slot, Number(raw))}
      options={[
        { value: '0', label: 'Use default' },
        ...endpoints.map(ep => ({ value: String(ep.id), label: ep.name })),
      ]}
    />
  );
};
