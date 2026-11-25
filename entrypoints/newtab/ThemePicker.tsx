import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { ENABLED_THEMES as THEMES, type ThemeId } from '../../lib/themes';

/** The next focused item for a key, with wrap-around. Any other key keeps the index. */
export function nextThemeIndex(index: number, key: string, count: number): number {
  if (count <= 0) return 0;
  switch (key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'ArrowDown':
    case 'ArrowRight':
      return (index + 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return index;
  }
}

/**
 * The Themes panel. It sits under the Themes button, lists the four enabled themes and keeps
 * itself open while the user picks, so themes can be compared.
 */
export function ThemePicker({
  open,
  themeId,
  onSelect,
  onClose,
  anchorRef,
}: {
  open: boolean;
  themeId: ThemeId;
  onSelect: (id: ThemeId) => void;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const selectedIndex = Math.max(
    0,
    THEMES.findIndex((t) => t.id === themeId),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);

  // Open: focus the selected theme.
  useLayoutEffect(() => {
    if (!open) return;
    setFocusIndex(selectedIndex);
    items.current[selectedIndex]?.focus();
    // Only when the panel opens; picking a theme must not move focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on a pointer press outside the panel and the button.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panel.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const focusItem = (i: number) => {
    setFocusIndex(i);
    items.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      // Two tab stops (the focused theme and Close): wrap between them.
      const active = document.activeElement;
      const onClose_ = active === closeBtn.current;
      if (!e.shiftKey && onClose_) {
        e.preventDefault();
        items.current[focusIndex]?.focus();
      } else if (e.shiftKey && !onClose_) {
        e.preventDefault();
        closeBtn.current?.focus();
      }
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      if (document.activeElement === closeBtn.current) return;
      e.preventDefault();
      focusItem(nextThemeIndex(focusIndex, e.key, THEMES.length));
    }
  };

  return (
    <div ref={panel} className="theme-picker" role="dialog" aria-modal="true" aria-label="Themes" onKeyDown={onKeyDown}>
      <ul className="theme-list">
        {THEMES.map((theme, i) => {
          const selected = theme.id === themeId;
          return (
            <li key={theme.id}>
              <button
                type="button"
                ref={(el) => {
                  items.current[i] = el;
                }}
                className="theme-item"
                aria-pressed={selected}
                tabIndex={i === focusIndex ? 0 : -1}
                onFocus={() => setFocusIndex(i)}
                onClick={() => onSelect(theme.id)}
              >
                <span
                  className="theme-swatch"
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(180deg, ${theme.surface['--sky-top']}, ${theme.surface['--sky-bottom']})`,
                  }}
                >
                  <span className="theme-swatch-dot" style={{ background: theme.surface['--accent'] }} />
                </span>
                <span className="theme-text">
                  <span className="theme-name">{theme.name}</span>
                  <span className="theme-desc">{theme.description}</span>
                </span>
                <span className="theme-check" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button ref={closeBtn} type="button" className="theme-close" onClick={() => { onClose(); anchorRef.current?.focus(); }}>
        Close
      </button>
    </div>
  );
}
