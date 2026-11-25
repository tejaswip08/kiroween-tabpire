import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cardActions, memoryRow } from '../../../lib/tips';
import { shortAge } from '../../../lib/vampireVoice';
import type { Card } from '../../../lib/view';
import { CloseIcon, StateShape } from './icons';
import { SiteIcon } from './SiteIcon';
import { CardActionButtons, cardTitle, type CardAction } from './TabCard';

const STATE_WORD = { awake: 'Awake', starving: 'Starving', asleep: 'Asleep', protected: 'Protected' } as const;

/**
 * The tabs that do not fit on screen, as compact rows: icon, title, state pill, idle time, memory and the same action
 * buttons as a card. A glass panel over the page; it scrolls inside itself, so the page never scrolls. Escape or
 * Close closes it and gives focus back to the "+N more" button.
 */
export function HiddenTabsPanel({
  cards,
  busyIds,
  allBusy,
  onAction,
  onClose,
}: {
  cards: readonly Card[];
  busyIds: ReadonlySet<number>;
  allBusy: boolean;
  onAction: (card: Card, action: CardAction) => void;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="hidden-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="hidden-panel" role="dialog" aria-modal="true" aria-labelledby="hidden-tabs-title">
        <header className="hidden-head">
          <h2 id="hidden-tabs-title" className="hidden-title">
            {cards.length === 1 ? '1 more tab' : `${cards.length} more tabs`}
          </h2>
          <button ref={close} type="button" className="hidden-close" onClick={onClose}>
            <CloseIcon size={16} />
            <span>Close</span>
          </button>
        </header>
        <ul className="hidden-list" role="list">
          {cards.map((card) => {
            const title = cardTitle(card);
            return (
              <li key={card.tab.id} className="hidden-row" data-state={card.state} data-tab-id={card.tab.id}>
                <SiteIcon faviconUrl={card.tab.favIconUrl} site={card.site} />
                <span className="hidden-text">
                  <span className="hidden-row-title" title={title}>
                    {title}
                  </span>
                  <span className="hidden-meta">
                    <span className="hidden-pill">
                      <StateShape state={card.state} size={11} />
                      {STATE_WORD[card.state]}
                    </span>
                    <span>{shortAge(card.hungerMs, card.info)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{memoryRow(card)}</span>
                  </span>
                </span>
                <span className="hidden-actions card-actions" data-count={cardActions(card.state).length}>
                  <CardActionButtons card={card} busy={allBusy || busyIds.has(card.tab.id)} onAction={onAction} />
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>,
    document.body,
  );
}
