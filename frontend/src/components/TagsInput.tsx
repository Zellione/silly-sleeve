import React, { useState } from 'react';

export interface TagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, hides the draft input and per-tag remove buttons (read-only). */
  disabled?: boolean;
  /** Placeholder shown while there are no tags. */
  placeholder?: string;
  /** Placeholder shown once at least one tag exists (defaults to ''). */
  placeholderWhenFilled?: string;
  /** Normalize a trimmed draft before adding (e.g. lowercasing). */
  normalize?: (draft: string) => string;
  /** Number of leading tags that receive the accent class. */
  accentCount?: number;
  /** Container class (defaults to the editor's `tags-input`). */
  className?: string;
  /** Extra container class applied when empty (no tags and no draft). */
  emptyClassName?: string;
  /** Per-tag class (defaults to `tag`). */
  tagClassName?: string;
  /** Class added to the first `accentCount` tags (defaults to `acc`). */
  accentClassName?: string;
}

/**
 * Token/tag entry field shared by the character editor's tag field and the
 * lorebook's trigger-key inputs. Draft text commits on Enter or comma,
 * Backspace on an empty draft removes the last tag, and duplicates are ignored.
 */
export const TagsInput: React.FC<TagsInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type and press Enter…',
  placeholderWhenFilled = '',
  normalize,
  accentCount = 0,
  className = 'tags-input',
  emptyClassName,
  tagClassName = 'tag',
  accentClassName = 'acc',
}) => {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const trimmed = draft.trim();
    const t = normalize ? normalize(trimmed) : trimmed;
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };

  const showEmpty = emptyClassName && value.length === 0 && draft === '';
  const containerClass = showEmpty ? `${className} ${emptyClassName}` : className;

  return (
    <div className={containerClass}>
      {value.map((t, i) => (
        <span key={t + String(i)} className={i < accentCount ? `${tagClassName} ${accentClassName}` : tagClassName}>
          {t}
          {!disabled && (
            <button
              type="button"
              className="x"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); submit(); }
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          placeholder={value.length ? placeholderWhenFilled : placeholder}
        />
      )}
    </div>
  );
};
