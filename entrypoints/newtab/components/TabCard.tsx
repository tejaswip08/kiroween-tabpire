import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import type { VampireState } from '../../../lib/hunger';
import type { ExitKind } from '../../../lib/scene/exitKinds';
import { formatMb } from '../../../lib/hunger';
import { idleLabel, type Card } from '../../../lib/view';
import { hungerShare, shortAge } from '../../../lib/vampireVoice';
import { usePortraitReady } from '../layers/portraitReady';
import { ActionButton } from './ActionButton';
import { CoffinIcon, CryptIcon, GarlicIcon, RemoveGarlicIcon, StakeIcon, StateShape } from './icons';
import { PortraitSlot } from './PortraitSlot';
import { SiteIcon } from './SiteIcon';
import { CardPopup } from './CardPopup';
import { HungerBar } from './HungerBar';

export type CardAction = 'stake' | 'coffin' | 'crypt' | 'garlic' | 'ungarlic';

const STATE_WORD: Record<VampireState, string> = {
  awake: 'Awake',
  starving: 'Starving',
  asleep: 'Asleep',
  protected: 'Protected',
};

export function cardTitle(card: Card): string {
  return card.tab.title?.trim() || card.site || 'Untitled tab';
}

interface ActionSpec {
  label: string;
  tip: string;
  disabled: boolean;
}

/** Label, tooltip and enabled state for each button on a card. */
export function actionSpecs(card: Card, busy: boolean): Record<'stake' | 'coffin' | 'crypt' | 'garlic', ActionSpec> {
  const wait = 'Please wait: another action is running.';
  const hasSite = card.site !== null;
  const isProtected = card.state === 'protected';
  return {
    stake: {
      label: 'Stake',
      tip: busy ? wait : 'Stake: close this tab.',
      disabled: busy,
    },
    coffin: {
      label: 'Coffin',
      tip: busy
        ? wait
        : card.info.active
          ? 'Coffin: this tab is in use and cannot be put to sleep.'
          : card.info.discarded
            ? 'Coffin: this tab is already asleep.'
            : 'Coffin: put this tab to sleep to free memory.',
      disabled: busy || card.info.active || card.info.discarded,
    },
    crypt: {
      label: 'Crypt',
      tip: busy ? wait : hasSite ? 'Crypt: save this tab for later and close it.' : 'Crypt: only web pages can be saved.',
      disabled: busy || !hasSite,
    },
    garlic: isProtected
      ? {
          label: 'Remove garlic',
          tip: busy ? wait : 'Remove garlic: let this site go hungry again.',
          disabled: busy,
        }
      : {
          label: 'Garlic',
          tip: busy ? wait : hasSite ? 'Garlic: protect every tab on this site.' : 'Garlic: only web pages can be protected.',
          disabled: busy || !hasSite,
        },
  };
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
  const specs = actionSpecs(card, busy);
  const isProtected = card.state === 'protected';
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
      <div className="card-actions">
        <ActionButton
          label={specs.stake.label}
          tip={specs.stake.tip}
          note={title}
          disabled={specs.stake.disabled}
          icon={<StakeIcon size={32} />}
          onClick={() => onAction(card, 'stake')}
        />
        <ActionButton
          label={specs.coffin.label}
          tip={specs.coffin.tip}
          note={title}
          disabled={specs.coffin.disabled}
          icon={<CoffinIcon size={32} />}
          onClick={() => onAction(card, 'coffin')}
        />
        <ActionButton
          label={specs.crypt.label}
          tip={specs.crypt.tip}
          note={title}
          disabled={specs.crypt.disabled}
          icon={<CryptIcon size={32} />}
          onClick={() => onAction(card, 'crypt')}
        />
        <ActionButton
          label={specs.garlic.label}
          tip={specs.garlic.tip}
          note={title}
          disabled={specs.garlic.disabled}
          icon={isProtected ? <RemoveGarlicIcon size={32} /> : <GarlicIcon size={32} />}
          onClick={() => onAction(card, isProtected ? 'ungarlic' : 'garlic')}
        />
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
      onMouseLeave: close,
      onFocus: (e: FocusEvent) => {
        if (keyboardFocus(e)) show(0);
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
