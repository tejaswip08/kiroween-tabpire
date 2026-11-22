/** Shown when the tab list cannot be read. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="state-panel" aria-labelledby="error-heading">
      <h2 id="error-heading" className="state-title">
        Tabpire could not read your tabs
      </h2>
      <p className="state-text">The browser did not answer. Nothing was changed. You can still search and use your pinned pages.</p>
      <button type="button" className="state-button" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}
