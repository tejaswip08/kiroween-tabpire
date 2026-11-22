import { useId, useState, type ReactElement, type KeyboardEvent } from 'react';

/**
 * Wraps one control with a tooltip. The control gets `aria-describedby`,
 * so screen readers read the tooltip text as its description.
 * Escape hides the tooltip while it is open (so it never traps the view).
 */
export function Tooltip({
  text,
  placement = 'top',
  hidden = false,
  note,
  children,
}: {
  text: string;
  /** Optional second line, for example the full tab title. */
  note?: string;
  placement?: 'top' | 'bottom';
  /** Hide the tooltip, for example while a popover from the same button is open. */
  hidden?: boolean;
  children: (props: { 'aria-describedby': string }) => ReactElement;
}) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setDismissed(true);
  };

  return (
    <span
      className="tip-wrap"
      data-dismissed={dismissed || hidden || undefined}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {children({ 'aria-describedby': id })}
      <span role="tooltip" id={id} className={`tip tip-${placement}`}>
        <span className="tip-text">{text}</span>
        {note && <span className="tip-note">{note}</span>}
      </span>
    </span>
  );
}
