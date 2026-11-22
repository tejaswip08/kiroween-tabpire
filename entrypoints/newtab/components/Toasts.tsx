import type { Toast } from '../hooks/useToasts';

/**
 * Short messages near the bottom of the page. Errors are announced at once,
 * other messages politely. The container lets clicks pass through to the cards.
 */
export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast"
          data-kind={t.kind}
          role={t.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-text">{t.text}</span>
          <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => onDismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
