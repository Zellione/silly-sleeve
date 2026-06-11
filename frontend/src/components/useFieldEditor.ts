import { useState, useEffect, useMemo, useCallback } from 'react';
import { CountTokens } from '../../wailsjs/go/main/App';
import { compose } from '../../wailsjs/go/models';

export interface FieldSpec {
  id: string;
  label: string;
  required: boolean;
  type: 'line' | 'text' | 'tags' | 'quotes' | 'stats';
  helper: string;
}

export const FIELDS: FieldSpec[] = [
  { id: 'name',          label: 'Name',                required: true,  type: 'line',   helper: 'How the model addresses the character.' },
  { id: 'epithet',       label: 'Title / epithet',     required: false, type: 'line',   helper: 'Optional flourish, shown beneath the name.' },
  { id: 'tags',          label: 'Tags',                 required: false, type: 'tags',   helper: "Used by SillyTavern's prompt filters." },
  { id: 'appearance',    label: 'Appearance',           required: true,  type: 'text',   helper: 'Sensory description: build, dress, marks.' },
  { id: 'personality',   label: 'Personality',          required: true,  type: 'text',   helper: 'Traits as a comma list or short prose.' },
  { id: 'backstory',     label: 'Backstory',            required: false, type: 'text',   helper: 'Compressed past — model condenses lore.' },
  { id: 'abilities',     label: 'Abilities & skills',   required: false, type: 'text',   helper: 'Powers, magic, mundane talents.' },
  { id: 'relationships', label: 'Relationships',        required: false, type: 'text',   helper: 'Allies, rivals, ties to other NPCs.' },
  { id: 'quotes',        label: 'Example quotes',       required: false, type: 'quotes', helper: 'Voice anchors — italic, in-character.' },
  { id: 'stats',         label: 'Stat block',           required: false, type: 'stats',  helper: 'Custom numbers — STR, HP, age, etc.' },
];

/** A field's value is one of three concrete shapes, keyed by `FieldSpec.type`. */
export type FieldValue = string | string[] | compose.StatKV[];

export interface FieldState {
  value: FieldValue;
  locked: boolean;
  dirty: boolean;
  showPrompt: boolean;
  prompt: string;
  rolling: boolean;
  history: number;
}

export function wordCount(val: FieldValue, type: string): number {
  if (typeof val === 'string') return val.trim().split(/\s+/).filter(Boolean).length;
  if (type === 'quotes') return (val as string[]).reduce((sum, q) => sum + q.trim().split(/\s+/).filter(Boolean).length, 0);
  return 0; // tags and stats contribute no word count
}

export function wordCountLabel(val: FieldValue, type: string): string {
  const wc = wordCount(val, type);
  if (Array.isArray(val) && type === 'tags') return val.length + ' tags';
  if (Array.isArray(val) && type === 'quotes') return val.length + ' quotes, ' + wc + ' words';
  if (Array.isArray(val) && type === 'stats') return val.length + ' rows';
  return wc + ' words';
}

export function charsFromFieldState(ch: compose.Character, fields: Record<string, FieldState>): compose.Character {
  return compose.Character.createFrom({
    ...ch,
    name: fields.name?.value ?? ch.name,
    epithet: fields.epithet?.value ?? ch.epithet,
    tags: fields.tags?.value ?? ch.tags,
    appearance: fields.appearance?.value ?? ch.appearance,
    personality: fields.personality?.value ?? ch.personality,
    backstory: fields.backstory?.value ?? ch.backstory,
    abilities: fields.abilities?.value ?? ch.abilities,
    relationships: fields.relationships?.value ?? ch.relationships,
    quotes: fields.quotes?.value ?? ch.quotes,
    stats: fields.stats?.value ?? ch.stats,
    dirty: Object.values(fields).some(f => f.dirty),
  });
}

export function fieldStateFromChar(ch: compose.Character, field: FieldSpec): FieldState {
  let val: FieldValue;
  switch (field.id) {
    case 'name': val = ch.name; break;
    case 'epithet': val = ch.epithet; break;
    case 'tags': val = ch.tags ?? []; break;
    case 'appearance': val = ch.appearance; break;
    case 'personality': val = ch.personality; break;
    case 'backstory': val = ch.backstory; break;
    case 'abilities': val = ch.abilities; break;
    case 'relationships': val = ch.relationships; break;
    case 'quotes': val = (ch.quotes && ch.quotes.length > 0) ? ch.quotes : ['']; break;
    case 'stats': val = (ch.stats && ch.stats.length > 0) ? ch.stats : [compose.StatKV.createFrom({ key: '', value: '' })]; break;
    default: val = '';
  }
  return { value: val, locked: false, dirty: false, showPrompt: false, prompt: '', rolling: false, history: 1 };
}

/** Re-derives the field map from a character, preserving locked fields' edits. */
function syncFields(prev: Record<string, FieldState>, ch: compose.Character): Record<string, FieldState> {
  const next: Record<string, FieldState> = {};
  for (const f of FIELDS) {
    const isLocked = prev[f.id]?.locked ?? false;
    const charVal = fieldStateFromChar(ch, f);
    next[f.id] = {
      value: isLocked ? (prev[f.id]?.value ?? charVal.value) : charVal.value,
      locked: isLocked,
      dirty: isLocked ? (prev[f.id]?.dirty ?? false) : false,
      showPrompt: isLocked ? (prev[f.id]?.showPrompt ?? false) : false,
      prompt: isLocked ? (prev[f.id]?.prompt ?? '') : '',
      rolling: false,
      history: prev[f.id]?.history ?? 1,
    };
  }
  return next;
}

async function countTokens(fields: Record<string, FieldState>): Promise<Record<string, number>> {
  const cache: Record<string, number> = {};
  for (const f of FIELDS) {
    const val = fields[f.id]?.value;
    let text = '';
    if (typeof val === 'string') {
      text = val;
    } else if (Array.isArray(val)) {
      text = JSON.stringify(val);
    }
    if (!text) {
      cache[f.id] = 0;
      continue;
    }
    try {
      cache[f.id] = await CountTokens(text);
    } catch {
      cache[f.id] = Math.round(text.length / 4);
    }
  }
  return cache;
}

const TOKEN_DEBOUNCE_MS = 300;

export interface UseFieldEditorOptions {
  /** Called after an interactive value edit (e.g. to trigger auto-save). */
  onValueChange?: () => void;
}

/**
 * Owns the character editor's per-field state machine: the field map, debounced
 * token counts, derived dirty/locked/composing tallies, and the mutators the
 * screen drives (edit, patch, apply generated values, build/save). The screen
 * keeps character CRUD and the LLM calls; it talks to fields only through here.
 */
export function useFieldEditor(activeChar: compose.Character | null, options: UseFieldEditorOptions = {}) {
  const { onValueChange } = options;
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [tokenCache, setTokenCache] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!activeChar) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(prev => syncFields(prev, activeChar));
  }, [activeChar]);

  // Debounced: editing a field shouldn't fire ~10 backend calls per keystroke.
  useEffect(() => {
    if (Object.keys(fields).length === 0) return;
    const timer = setTimeout(() => { void countTokens(fields).then(setTokenCache); }, TOKEN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fields]);

  const totalTokens = useMemo(() => Object.values(tokenCache).reduce((a, b) => a + b, 0), [tokenCache]);
  const dirtyCount = useMemo(() => Object.values(fields).filter(f => f.dirty).length, [fields]);
  const lockedCount = useMemo(() => Object.values(fields).filter(f => f.locked).length, [fields]);
  const isComposing = useMemo(() => Object.values(fields).some(f => f.rolling), [fields]);
  const ready = Object.keys(fields).length > 0;

  const setFieldValue = useCallback((id: string, value: FieldValue) => {
    setFields(prev => ({ ...prev, [id]: { ...prev[id], value } }));
    onValueChange?.();
  }, [onValueChange]);

  const patchField = useCallback((id: string, patch: Partial<FieldState>) => {
    setFields(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const patchAll = useCallback((patch: Partial<FieldState>, filter?: (st: FieldState) => boolean) => {
    setFields(prev => {
      const next: Record<string, FieldState> = { ...prev };
      for (const id of Object.keys(prev)) {
        if (!filter || filter(prev[id])) next[id] = { ...prev[id], ...patch };
      }
      return next;
    });
  }, []);

  /** Replace one field's value from a freshly generated character (bumps history). */
  const applyGenerated = useCallback((id: string, ch: compose.Character, extra?: Partial<FieldState>) => {
    const spec = FIELDS.find(f => f.id === id);
    if (!spec) return;
    const val = fieldStateFromChar(ch, spec);
    setFields(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        value: val.value,
        dirty: false,
        rolling: false,
        history: (prev[id]?.history ?? 1) + 1,
        ...extra,
      },
    }));
  }, []);

  const markAllSaved = useCallback(() => patchAll({ dirty: false }), [patchAll]);

  const buildCharacter = useCallback((base: compose.Character) => charsFromFieldState(base, fields), [fields]);

  const lockedIds = useCallback(() => FIELDS.filter(f => fields[f.id]?.locked).map(f => f.id), [fields]);

  return {
    fields,
    tokenCache,
    totalTokens,
    dirtyCount,
    lockedCount,
    isComposing,
    ready,
    setFieldValue,
    patchField,
    patchAll,
    applyGenerated,
    markAllSaved,
    buildCharacter,
    lockedIds,
  };
}
