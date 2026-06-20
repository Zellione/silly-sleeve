import { useRef } from 'react';

export interface RadioGroupOption {
  id: string;
  label: string;
}

interface RadioGroupProps<T extends RadioGroupOption> {
  /** Accessible name for the group. */
  ariaLabel: string;
  options: T[];
  /** Currently selected option id. */
  value: string;
  onChange: (id: string) => void;
  /** Class on the radiogroup container. */
  className?: string;
  /** Class on each radio button. */
  optionClassName?: string;
  /** Renders the visible content of a radio (optional — swatches need none). */
  renderOption?: (option: T, checked: boolean) => React.ReactNode;
  /** Inline style applied to the radio button (e.g. a swatch background). */
  getOptionStyle?: (option: T) => React.CSSProperties;
  /**
   * Sets an explicit aria-label on each radio. Use for options whose rendered
   * content is non-textual (e.g. colour swatches). Omit when renderOption
   * already produces readable text.
   */
  getOptionLabel?: (option: T) => string;
}

// RadioGroup renders an accessible single-select radiogroup per the WAI-ARIA
// Authoring Practices: one tab stop (roving tabindex) and Arrow / Home / End
// navigation that moves focus and selection together, wrapping at the ends.
// Each option is a real <button> (Space/Enter activate natively) with
// role="radio".
export function RadioGroup<T extends RadioGroupOption>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
  optionClassName,
  renderOption,
  getOptionStyle,
  getOptionLabel,
}: RadioGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const hasSelection = options.some(o => o.id === value);

  const selectAt = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const moves: Record<string, number | undefined> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: options.length - 1,
    };
    const target = moves[e.key];
    if (target === undefined) return;
    e.preventDefault();
    selectAt(target);
  };

  return (
    <div className={className} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const checked = option.id === value;
        const focusable = checked || (!hasSelection && index === 0);
        return (
          <button
            key={option.id}
            ref={el => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={getOptionLabel?.(option)}
            tabIndex={focusable ? 0 : -1}
            data-on={checked ? '1' : '0'}
            className={optionClassName}
            style={getOptionStyle?.(option)}
            onClick={() => onChange(option.id)}
            onKeyDown={e => onKeyDown(e, index)}
          >
            {renderOption?.(option, checked)}
          </button>
        );
      })}
    </div>
  );
}

export default RadioGroup;
