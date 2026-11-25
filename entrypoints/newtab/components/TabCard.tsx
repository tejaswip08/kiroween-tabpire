import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from 'react';
import { ACTION_LABEL, actionTip, cardActions, type TipAction, type TipContent } from '../../../lib/tips';
import type { VampireState } from '../../../lib/hunger';
import type { ExitKind } from '../../../lib/scene/exitKinds';
import { formatMb } from '../../../lib/hunger';
import { idleLabel, type Card } from '../../../lib/view';
import { hungerShare, shortAge } from '../../../lib/vampireVoice';
import { usePortraitReady } from '../layers/portraitReady';
import { ActionButton } from './ActionButton';
import { CoffinIcon, CryptIcon, GarlicIcon, RemoveGarlicIcon, StakeIcon, StateShape, WakeIcon } from './icons';
import { PortraitSlot } from './PortraitSlot';
import { SiteIcon } from './SiteIcon';
import { CardPopup } from './CardPopup';
import { HungerBar } from './HungerBar';

export type CardAction = TipAction;
const STATE_WORD: Record<VampireState, string> = {
  awake: 'Awake',
  starving: 'Starving',
  asleep: 'Asleep',
  protected: 'Protected',
};
export function cardTitle(card: Card): string {
  return card.tab.title?.trim() || card.site || 'Untitled tab';
}
export interface ActionSpec {
  action: CardAction;
  label: string;
  tip: TipContent;
  disabled: boolean;
}
/** The buttons of a card, in order, with their rich tip and enabled state. */
export function actionSpecs(card: Card, busy: boolean): ActionSpec[] {
  const hasSite = card.site !== null;
  const blocked: Record<CardAction, boolean> = {
    stake: false,
    coffin: card.info.active || card.info.discarded,
    crypt: !hasSite,
    garlic: !hasSite,
    ungarlic: false,
    wake: false,
  };
  return cardActions(card.state).map((action) => ({
    action,
    label: ACTION_LABEL[action],
    tip: actionTip(action, card, busy),
    disabled: busy || blocked[action],
  }));
}
const ICONS: Record<CardAction, () => ReactNode> = {
  stake: () => <StakeIcon size={32} />,
  coffin: () => <CoffinIcon size={32} />,
  crypt: () => <CryptIcon size={32} />,
  garlic: () => <GarlicIcon size={32} />,
  ungarlic: () => <RemoveGarlicIcon size={32} />,
  wake: () => <WakeIcon size={32} />,
};
/** The action buttons of a tab: on its card, and on its row in the hidden tabs panel. */
export function CardActionButtons({ card, busy, onAction }: { card: Card; busy: boolean; onAction: (card: Card, action: CardAction) => void }) {
  return (
    <>
      {actionSpecs(card, busy).map((spec) => (
        <ActionButton
          key={spec.action}
          label={spec.label}
          tip={spec.tip}
          disabled={spec.disabled}
          icon={ICONS[spec.action]()}
          onClick={() => onAction(card, spec.action)}
        />
      ))}
    </>
  );
}
export function TabCard({
  card,
  busy,
  index,
  exiting = false,
  exitKind,
  exitMs,
  exitFadeDelayMs,
  onAction,
}: {
  card: Card;
  /** True while an action runs on this card or Dawn is running. */
  busy: boolean;
  /** Position in the list, used only to stagger the entry animation. */
  index: number;
  exiting?: boolean;
  /** Which action the card is leaving by (for the portrait). */
  exitKind?: ExitKind;
  /** How long the card stays while it leaves, in milliseconds. */
  exitMs?: number;
  /** How long the card body waits before it starts to fade. */
  exitFadeDelayMs?: number;
  onAction: (card: Card, action: CardAction) => void;
}) {
  const title = cardTitle(card);
  const idle = idleLabel(card);
  const portrait3d = usePortraitReady(card.tab.id);
  const popup = useCardPopup(!exiting);
  const popupId = useId();

  return (
    <li
      className={`card${exiting ? ' card-exiting' : ''}`}
      data-state={card.state}
      data-tab-id={card.tab.id}
      data-3d={portrait3d ? 'on' : undefined}
      data-exit={exiting ? exitKind : undefined}
      style={
        {
          '--i': Math.min(index, 11),
          ...(exiting && exitMs !== undefined ? { '--exit-ms': `${exitMs}ms`, '--exit-fade-delay': `${exitFadeDelayMs ?? 0}ms` } : {}),
        } as CSSProperties
      }
      aria-hidden={exiting || undefined}
      inert={exiting || undefined}
      aria-describedby={popup.open ? popupId : undefined}
      ref={popup.ref}
      {...popup.handlers}
    >
      <span className="card-frame" aria-hidden="true" />
      <PortraitSlot state={card.state} />
      <span className="card-badge">
        <SiteIcon faviconUrl={card.tab.favIconUrl} site={card.site} />
      </span>
      <h3 className="card-title" title={title}>
        {title}
      </h3>
      <p className="card-site">{card.site ?? 'Not a web page'}</p>
      <p className="card-meta">
        <span className="state-badge">
          <StateShape state={card.state} />
          {STATE_WORD[card.state]}
        </span>
        <span className="card-age">{shortAge(card.hungerMs, card.info)}</span>
        <span className="card-sep" aria-hidden="true">
          ·
        </span>
        <span className="card-memory">{formatMb(card.mb)}</span>
      </p>
      <HungerBar fill={hungerShare(card.hungerMs)} label={`Hunger meter: ${idle}`} />
      <div className="card-actions" data-count={actionSpecs(card, busy).length}>
        <CardActionButtons card={card} busy={busy} onAction={onAction} />
      </div>
      {popup.open && <CardPopup card={card} title={title} anchor={popup.anchor} id={popupId} />}
    </li>
  );
}

/** How long the pointer must rest on a card before its popup opens. */
export const POPUP_DELAY_MS = 300;
/** Opens a card's popup after a short hover, or at once on keyboard focus. Escape and leaving close it. */
function useCardPopup(enabled: boolean) {
  const ref = useRef<HTMLLIElement>(null);
  const timer = useRef(0);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  const show = (delay: number) => {
    if (!enabled) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAnchor(ref.current);
      setOpen(true);
    }, delay);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!enabled) close();
  }, [enabled]);
  const keyboardFocus = (e: FocusEvent) => {
    try {
      return (e.target as HTMLElement).matches(':focus-visible');
    } catch {
      return false;
    }
  };
  return {
    ref,
    open,
    anchor,
    handlers: {
      onMouseEnter: () => show(POPUP_DELAY_MS),
      // Over the action buttons their own tips show, so the card's hover box closes and never sits on top of them.
      onMouseOver: (e: { target: EventTarget }) => {
        const onButtons = (e.target as Element).closest?.('.card-actions') != null;
        if (onButtons) close();
        else if (!open) show(POPUP_DELAY_MS);
      },
      onMouseLeave: close,
      onFocus: (e: FocusEvent) => {
        // A focused action button shows its own tip instead.
        if ((e.target as Element).closest?.('.card-actions')) close();
        else if (keyboardFocus(e)) show(0);
      },
      onBlur: (e: FocusEvent) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) close();
      },
      onKeyDown: (e: { key: string }) => {
        if (e.key === 'Escape') close();
      },
    },
  };
}
