import type { Card } from '../../../lib/view';
import { useExitingCards } from '../hooks/useExitingCards';
import { TabCard, type CardAction } from './TabCard';

export function CardGrid({
  cards,
  busyIds,
  allBusy,
  onAction,
}: {
  cards: Card[];
  busyIds: ReadonlySet<number>;
  /** True while Dawn runs. */
  allBusy: boolean;
  onAction: (card: Card, action: CardAction) => void;
}) {
  const display = useExitingCards(cards);

  return (
    <section aria-labelledby="open-tabs-heading">
      <h2 id="open-tabs-heading" className="sr-only">
        Open tabs, hungriest first
      </h2>
      <ul className="card-grid" role="list">
        {display.map(({ card, exiting }, index) => (
          <TabCard
            key={card.tab.id}
            card={card}
            index={index}
            exiting={exiting}
            busy={allBusy || busyIds.has(card.tab.id)}
            onAction={onAction}
          />
        ))}
      </ul>
    </section>
  );
}
