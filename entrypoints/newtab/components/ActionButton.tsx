import type { ReactNode } from 'react';
import type { TipContent } from '../../../lib/tips';
import { Tooltip } from './Tooltip';

/**
 * Round icon button with a tooltip.
 * A disabled button stays focusable (aria-disabled), so keyboard users can read why.
 */
export function ActionButton({
  label,
  tip,
  icon,
  disabled = false,
  note,
  onClick,
  tone,
}: {
  /** Accessible name, e.g. "Stake". */
  label: string;
  /** Tooltip: plain text, or a rich tip (title, the vampire's line, points, note). */
  tip: string | TipContent;
  icon: ReactNode;
  /** Extra line in the tooltip. The card passes the full tab title here. */
  note?: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <Tooltip {...(typeof tip === 'string' ? { text: tip, note } : { content: tip })}>
      {(describedBy) => (
        <button
          type="button"
          className="icon-btn"
          data-tone={tone}
          aria-label={label}
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (!disabled) onClick();
          }}
          {...describedBy}
        >
          {icon}
        </button>
      )}
    </Tooltip>
  );
}
