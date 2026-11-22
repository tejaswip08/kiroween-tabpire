import { VampireEmblem } from './icons';

/** Shown when no other tab is open. The sleeping vampire means: nothing is draining memory. */
export function EmptyState() {
  return (
    <section className="state-panel" aria-labelledby="empty-heading">
      <div className="state-emblem">
        <VampireEmblem state="asleep" />
      </div>
      <h2 id="empty-heading" className="state-title">
        Nothing is draining memory
      </h2>
      <p className="state-text">No other tabs are open, so your browser is resting. Open some tabs and they will show up here.</p>
    </section>
  );
}
