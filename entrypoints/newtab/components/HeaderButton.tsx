import type { ReactNode, Ref } from 'react';
import type { TipContent } from '../../../lib/tips';
import { Tooltip } from './Tooltip';

/** Pill button for the header. Disabled buttons stay focusable so the tooltip can be read. */
export function HeaderButton({
  label,
  icon,
  tip,
  disabled = false,
  busy = false,
  badge,
  className = '',
  onClick,
  ref,
  popup,
  tipHidden,
  expanded,
}: {
  label: string;
  icon: ReactNode;
  tip: string | TipContent;
  disabled?: boolean;
  busy?: boolean;
  badge?: number;
  className?: string;
  onClick?: () => void;
  ref?: Ref<HTMLButtonElement>;
  /** Sets aria-haspopup, for a button that opens a panel. */
  popup?: 'dialog';
  expanded?: boolean;
  /** Hides the tooltip, for example while the panel is open. */
  tipHidden?: boolean;
}) {
  return (
    <Tooltip {...(typeof tip === 'string' ? { text: tip } : { content: tip })} placement="bottom" hidden={tipHidden}>
      {(describedBy) => (
        <button
          type="button"
          ref={ref}
          aria-haspopup={popup}
          aria-expanded={expanded}
          className={`header-btn ${className}`.trim()}
          aria-disabled={disabled || undefined}
          aria-busy={busy || undefined}
          onClick={() => {
            if (!disabled) onClick?.();
          }}
          {...describedBy}
        >
          <span className="header-btn-icon">{icon}</span>
          <span className="header-btn-label">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="header-btn-count" aria-label={`${badge} ready`}>
              {badge}
            </span>
          )}
        </button>
      )}
    </Tooltip>
  );
}
