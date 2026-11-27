import { EyeIcon, EyeOffIcon } from './icons';

/** Small pill next to the state chips: hides the cards to show the whole scene, or brings them back. */
export function CardsToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="cards-toggle"
      aria-pressed={hidden}
      aria-controls="card-grid"
      title={hidden ? 'Bring the vampire cards back' : 'Hide the vampire cards to see the whole scene'}
      onClick={onToggle}
    >
      {hidden ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
      <span>{hidden ? 'Show tabs' : 'Hide tabs'}</span>
    </button>
  );
}
