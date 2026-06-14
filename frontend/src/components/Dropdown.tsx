import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  /** Controlled selected value. Omit (with `defaultValue`) for uncontrolled use. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  /** Shown on the trigger when no option matches the current value. */
  placeholder?: string;
  title?: string;
  'aria-label'?: string;
  'data-source'?: string;
}

/**
 * Themeable replacement for a native `<select>`. WebKitGTK renders the native
 * option popup with its own light theming that ignores CSS and `color-scheme`,
 * so we render the list as ordinary DOM and style it with the app's tokens.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  defaultValue,
  onChange,
  id,
  className,
  style,
  disabled,
  placeholder,
  title,
  'aria-label': ariaLabel,
  'data-source': dataSource,
}) => {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? value : internal;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const selectedIndex = options.findIndex(o => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (opt: DropdownOption) => {
      if (opt.disabled) return;
      if (!isControlled) setInternal(opt.value);
      onChange?.(opt.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [isControlled, onChange],
  );

  // Close when focus/click leaves the component.
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  const step = (dir: 1 | -1) => {
    setActive(prev => {
      let i = prev;
      for (let n = 0; n < options.length; n++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i]?.disabled) return i;
      }
      return prev;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openMenu();
        else step(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openMenu();
        else step(-1);
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActive(options.findIndex(o => !o.disabled));
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i].disabled) { setActive(i); break; }
          }
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) openMenu();
        else if (options[active]) choose(options[active]);
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="ss-dropdown" ref={rootRef} style={style}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={className ? `ss-dropdown-trigger ${className}` : 'ss-dropdown-trigger'}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-label={ariaLabel}
        title={title}
        data-source={dataSource}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="ss-dropdown-value">{selected ? selected.label : placeholder ?? ''}</span>
        <span className="ss-dropdown-caret" aria-hidden="true" />
      </button>
      {open && (
        <ul className="ss-dropdown-list" id={listId} role="listbox" aria-label={ariaLabel}>
          {options.map((opt, i) => (
            // Keyboard selection is handled on the combobox via aria-activedescendant.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={opt.value}
              id={optionId(i)}
              role="option"
              aria-selected={opt.value === current}
              aria-disabled={opt.disabled || undefined}
              className={`ss-dropdown-option${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(opt)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
