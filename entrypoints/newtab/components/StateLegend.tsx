import type { VampireState } from '../../../lib/hunger';
import { countByState } from '../../../lib/legend';
import type { Card } from '../../../lib/view';
import { STATE_HINT, STATE_LABEL, STATE_ORDER } from '../../../lib/vampireVoice';
/**
 * A centred row of four chips: state, live count and a small hint. A chip with no tabs is dimmed.
 * Clicking a chip shows only that state; clicking it again shows all.
 */
export function StateLegend({
  cards,
  filter,
  onToggle,
}: {
  cards: readonly Card[];
  filter: VampireState | null;
  onToggle: (state: VampireState) => void;
}) {
  const counts = countByState(cards);
  return (
    <ul className="legend" role="list" aria-label="Filter by state">
      {STATE_ORDER.map((state) => (
        <li key={state}>
          <button
            type="button"
            className="legend-chip"
            data-state={state}
            data-empty={counts[state] === 0 || undefined}
            aria-pressed={filter === state}
            onClick={() => onToggle(state)}
          >
            <span className="legend-dot" aria-hidden="true" />
            <span className="legend-label">{STATE_LABEL[state]}</span>
            <span className="legend-count">{counts[state]}</span>
            <span className="legend-hint">{STATE_HINT[state]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
