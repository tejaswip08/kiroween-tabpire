import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cardActions, memoryRow } from "../../../lib/tips";
import { shortAge } from "../../../lib/vampireVoice";
import type { Card } from "../../../lib/view";
import { BatMark, CloseIcon, StateShape } from "./icons";
import { SiteIcon } from "./SiteIcon";
import { CardActionButtons, cardTitle, type CardAction } from "./TabCard";

const STATE_WORD = {
  awake: "Awake",
  starving: "Starving",
  asleep: "Asleep",
  protected: "Protected",
} as const;

/**
 * The tabs that do not fit on screen, as compact rows: icon, title, state pill, idle time, memory and the same action
 * buttons as a card. A glass panel over the page; it scrolls inside itself, so the page never scrolls. Escape or
 * Close (or a click on the dimmed backdrop) closes it and gives focus back to the "+N more" button. Tab stays inside it.
 */
const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';
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
  const panel = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  // True while more rows sit below the visible part of the list: shows the fade at the bottom edge.
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const l = list.current;
    if (l) setMore(l.scrollHeight - l.scrollTop - l.clientHeight > 2);
  }, []);
  useEffect(measure, [measure, cards.length]);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const inside = panel.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="hidden-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={panel}
        className="hidden-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hidden-tabs-title"
      >
        <header className="hidden-head">
          <h2 id="hidden-tabs-title" className="hidden-title">
            <BatMark size={30} className="hidden-title-mark" />
            <span className="hidden-count">{cards.length}</span>
            {cards.length === 1 ? " more tab" : " more tabs"}
          </h2>
          <button
            ref={close}
            type="button"
            className="hidden-close"
            onClick={onClose}
          >
            <span className="hidden-close-icon">
              <CloseIcon size={16} />
            </span>
            <span>Close</span>
          </button>
        </header>
        <div className="hidden-scroll" data-more={more || undefined}>
          <ul ref={list} className="hidden-list" role="list" onScroll={measure}>
            {cards.map((card) => {
              const title = cardTitle(card);
              return (
                <li
                  key={card.tab.id}
                  className="hidden-row"
                  data-state={card.state}
                  data-tab-id={card.tab.id}
                >
                  <span className="hidden-icon-tile">
                    <SiteIcon
                      faviconUrl={card.tab.favIconUrl}
                      site={card.site}
                    />
                  </span>
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
                  <span
                    className="hidden-actions card-actions"
                    data-count={cardActions(card.state).length}
                  >
                    <CardActionButtons
                      card={card}
                      busy={allBusy || busyIds.has(card.tab.id)}
                      onAction={onAction}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>,
    document.body,
  );
}
