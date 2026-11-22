import type { ReactNode } from 'react';
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
}: {
  label: string;
  icon: ReactNode;
  tip: string;
  disabled?: boolean;
  busy?: boolean;
  badge?: number;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip text={tip} placement="bottom">
      {(describedBy) => (
        <button
          type="button"
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
