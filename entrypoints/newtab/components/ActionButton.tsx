import type { ReactNode } from 'react';
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
  /** Tooltip text: the explanation, or the reason when disabled. */
  tip: string;
  icon: ReactNode;
  /** Extra line in the tooltip. The card passes the full tab title here. */
  note?: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <Tooltip text={tip} note={note}>
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
