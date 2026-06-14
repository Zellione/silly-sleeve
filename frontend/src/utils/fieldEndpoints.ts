import type { settings } from '../../wailsjs/go/models';

export interface Slot {
  id: string;
  label: string;
}

/** Generation slots, in display order. Field ids mirror useFieldEditor FIELDS. */
export const SLOTS: Slot[] = [
  { id: 'bulk', label: 'Bulk generation' },
  { id: 'name', label: 'Name' },
  { id: 'epithet', label: 'Title / epithet' },
  { id: 'tags', label: 'Tags' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'personality', label: 'Personality' },
  { id: 'backstory', label: 'Backstory' },
  { id: 'abilities', label: 'Abilities & skills' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'quotes', label: 'Example quotes' },
  { id: 'stats', label: 'Stat block' },
];

export type EndpointSource = 'project' | 'global' | 'default';

export interface Resolution {
  endpoint?: settings.LLMEndpoint;
  source: EndpointSource;
}

function byId(endpoints: settings.LLMEndpoint[], id?: number): settings.LLMEndpoint | undefined {
  if (!id || id <= 0) return undefined;
  return endpoints.find(e => e.id === id);
}

/** Resolves the effective endpoint for a slot, mirroring App.endpointForSlot. */
export function resolveEndpoint(
  slot: string,
  endpoints: settings.LLMEndpoint[],
  globalMap: Record<string, number> = {},
  projectMap: Record<string, number> = {},
): Resolution {
  const proj = byId(endpoints, projectMap[slot]);
  if (proj) return { endpoint: proj, source: 'project' };
  const glob = byId(endpoints, globalMap[slot]);
  if (glob) return { endpoint: glob, source: 'global' };
  const def = endpoints.find(e => e.isDefault) ?? endpoints[0];
  return { endpoint: def, source: 'default' };
}
