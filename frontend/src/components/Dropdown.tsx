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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const selectedIndex = options.findIndex(o => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // The list is `position: fixed` and anchored here (rather than `absolute`
  // relative to the trigger) so it isn't clipped by a scrollable ancestor's
  // implicit overflow-x — e.g. a narrow sidebar column with `overflow-y:
  // auto` also computes overflow-x to a non-visible value, cutting off any
  // option text wider than the column.
  const updateCoords = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActive(Math.max(selectedIndex, 0));
    updateCoords();
    setOpen(true);
  }, [disabled, selectedIndex, updateCoords]);

  // Keep the list anchored to the trigger if the page scrolls or resizes
  // while it's open.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open, updateCoords]);

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
      const target = e.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  const firstEnabled = () => options.findIndex(o => !o.disabled);
  const lastEnabled = () => options.reduce((acc, o, i) => (o.disabled ? acc : i), active);

  const step = (dir: 1 | -1) => {
    setActive(prev => {
      const n = options.length;
      const order = Array.from(options.keys(), k => ((prev + dir * (k + 1)) % n + n) % n);
      return order.find(i => !options[i]?.disabled) ?? prev;
    });
  };

  const moveActive = (dir: 1 | -1) => {
    if (open) step(dir);
    else openMenu();
  };

  const confirmActive = () => {
    if (!open) {
      openMenu();
      return;
    }
    const opt = options[active];
    if (opt) choose(opt);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(-1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        confirmActive();
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActive(firstEnabled());
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActive(lastEnabled());
        }
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

  // The combobox/listbox ARIA roles are intentional: a native <select> is what
  // we are replacing, because WebKitGTK renders its option popup with an
  // unthemeable light background. We implement the WAI-ARIA listbox pattern instead.
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
      {open && coords && (
        <ul
          className="ss-dropdown-list"
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: coords.width }}
        >
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
