import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { COMPACT_BELOW, fitCards } from '../../../lib/cardFit';
import { HiddenTabsPanel } from './HiddenTabsPanel';
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
  // The cards never scroll: they shrink to fit (up to two rows), and if there are too many the first ones are shown plus
  // a "+N more" button that lists the rest in a panel.
  const fit = fitCards(size.w, size.h, display.length, size.full);
  const shown = display.slice(0, fit.shown);
  // The tabs behind "+N more": the cards that do not fit (cards that are already leaving are not listed).
  const hidden = display.slice(fit.shown).filter((d) => !d.exiting).map((d) => d.card);
  const [panelOpen, setPanelOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    moreButton.current?.focus();
  }, []);
  // Nothing left to list: the panel closes by itself.
  useEffect(() => {
    if (panelOpen && hidden.length === 0) setPanelOpen(false);
  }, [panelOpen, hidden.length]);
  return (
    <section className="cards-area" ref={area} aria-labelledby="open-tabs-heading">
      <h2 id="open-tabs-heading" className="sr-only">
        Open tabs, hungriest first
      </h2>
      <ul
        className="card-grid"
        role="list"
        data-compact={fit.scale < COMPACT_BELOW || undefined}
        style={{ '--card-scale': fit.scale } as CSSProperties}
      >
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
          <li className="card-more">
            <button
              ref={moreButton}
              type="button"
              className="card-more-btn"
              aria-haspopup="dialog"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen(true)}
            >
              <span className="card-more-count">+{fit.more} more</span>
              <span className="card-more-note">Show the hidden tabs</span>
            </button>
          </li>
        )}
      </ul>
      {panelOpen && hidden.length > 0 && (
        <HiddenTabsPanel cards={hidden} busyIds={busyIds} allBusy={allBusy} onAction={onAction} onClose={closePanel} />
      )}
    </section>
  );
}
