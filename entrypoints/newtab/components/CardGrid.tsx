import type { CSSProperties } from 'react';
import { fitCards } from '../../../lib/cardFit';
import type { Card } from '../../../lib/view';
import { useAreaSize } from '../hooks/useAreaSize';
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
  const [area, size] = useAreaSize<HTMLDivElement>();
  // The cards never scroll: they shrink to fit, and if there are too many the hungriest are shown plus "+N more".
  const fit = fitCards(size.w, size.h, display.length, size.full);
  const shown = display.slice(0, fit.shown);
  return (
    <section className="cards-area" ref={area} aria-labelledby="open-tabs-heading">
      <h2 id="open-tabs-heading" className="sr-only">
        Open tabs, hungriest first
      </h2>
      <ul className="card-grid" role="list" style={{ '--card-scale': fit.scale } as CSSProperties}>
        {shown.map(({ card, exiting, exitKind, exitMs, exitFadeDelayMs }, index) => (
          <TabCard
            key={card.tab.id}
            card={card}
            index={index}
            exiting={exiting}
            exitKind={exitKind}
            exitMs={exitMs}
            exitFadeDelayMs={exitFadeDelayMs}
            busy={allBusy || busyIds.has(card.tab.id)}
            onAction={onAction}
          />
        ))}
        {fit.more > 0 && (
          <li className="card-more" title={`${fit.more} more tabs are open. The hungriest are shown.`}>
            <span className="card-more-count">+{fit.more} more</span>
            <span className="card-more-note">tabs not shown</span>
          </li>
        )}
      </ul>
    </section>
  );
}
