import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hungerPercent, lastUsedText, STATE_EXPLANATION, STATE_LABEL } from '../../../lib/vampireVoice';
import { cardQuote, memoryRow } from '../../../lib/tips';
import { placePopup } from '../../../lib/popupPlace';
import type { Card } from '../../../lib/view';
import { SiteIcon } from './SiteIcon';
export const POPUP_WIDTH = 320;
/**
 * The info popup of a card: full title, state and hunger, the vampire's quote, a plain sentence about the
 * state, and when the tab was last used. It sits above the card (or beside it near the edges), stays inside the
 * window, and takes no clicks, so it never blocks the card's buttons.
 */
export function CardPopup({ card, title, anchor, id }: { card: Card; title: string; anchor: HTMLElement | null; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const p = placePopup(a, POPUP_WIDTH, el.offsetHeight, window.innerWidth, window.innerHeight);
    setPos({ left: Math.round(p.left), top: Math.round(p.top) });
  }, [anchor, card, title]);
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="card-popup"
      data-state={card.state}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: POPUP_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="popup-head">
        <SiteIcon faviconUrl={card.tab.favIconUrl} site={card.site} />
        <p className="popup-title">{title}</p>
      </div>
      <p className="popup-site">{card.site ?? 'Not a web page'}</p>
      <p className="popup-state">
        <span className="popup-dot" aria-hidden="true" />
        {STATE_LABEL[card.state]} · Hunger {hungerPercent(card.hungerMs)}%
      </p>
      <p className="popup-quote">“{cardQuote(card)}”</p>
      <p className="popup-text">{STATE_EXPLANATION[card.state]}</p>
      <dl className="popup-facts">
        <dt>Last used</dt>
        <dd>{lastUsedText(card.hungerMs, card.info)}</dd>
        <dt>Memory</dt>
        <dd>{memoryRow(card)}</dd>
      </dl>
    </div>,
    document.body,
  );
}
