import type { VampireState } from '../../../lib/hunger';
import { formatMemory, idleLabel, vialFill, type Card } from '../../../lib/view';
import { ActionButton } from './ActionButton';
import { CoffinIcon, CryptIcon, GarlicIcon, RemoveGarlicIcon, StakeIcon, StateShape } from './icons';
import { PortraitSlot } from './PortraitSlot';
import { SiteIcon } from './SiteIcon';
import { Vial } from './Vial';

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
  onAction,
}: {
  card: Card;
  /** True while an action runs on this card or Dawn is running. */
  busy: boolean;
  /** Position in the list, used only to stagger the entry animation. */
  index: number;
  exiting?: boolean;
  onAction: (card: Card, action: CardAction) => void;
}) {
  const title = cardTitle(card);
  const idle = idleLabel(card);
  const specs = actionSpecs(card, busy);
  const isProtected = card.state === 'protected';

  return (
    <li
      className={`card${exiting ? ' card-exiting' : ''}`}
      data-state={card.state}
      data-tab-id={card.tab.id}
      style={{ ['--i' as string]: Math.min(index, 11) }}
      aria-hidden={exiting || undefined}
      inert={exiting || undefined}
    >
      <div className="card-head">
        <SiteIcon faviconUrl={card.tab.favIconUrl} site={card.site} />
        <h3 className="card-title" title={title}>
          {title}
        </h3>
        <span className="state-badge">
          <StateShape state={card.state} />
          {STATE_WORD[card.state]}
        </span>
      </div>

      <div className="card-body">
        <PortraitSlot state={card.state} />
        <div className="card-facts">
          <p className="card-idle">{idle}</p>
          <p className="card-memory">{formatMemory(card.mb)}</p>
          <p className="card-site">{card.site ?? 'Not a web page'}</p>
        </div>
        <Vial fill={vialFill(card.hungerMs)} label={`Hunger meter: ${idle}`} />
      </div>

      <div className="card-actions">
        <ActionButton
          label={specs.stake.label}
          tip={specs.stake.tip}
          note={title}
          disabled={specs.stake.disabled}
          icon={<StakeIcon size={28} />}
          onClick={() => onAction(card, 'stake')}
        />
        <ActionButton
          label={specs.coffin.label}
          tip={specs.coffin.tip}
          note={title}
          disabled={specs.coffin.disabled}
          icon={<CoffinIcon size={28} />}
          onClick={() => onAction(card, 'coffin')}
        />
        <ActionButton
          label={specs.crypt.label}
          tip={specs.crypt.tip}
          note={title}
          disabled={specs.crypt.disabled}
          icon={<CryptIcon size={28} />}
          onClick={() => onAction(card, 'crypt')}
        />
        <ActionButton
          label={specs.garlic.label}
          tip={specs.garlic.tip}
          note={title}
          disabled={specs.garlic.disabled}
          icon={isProtected ? <RemoveGarlicIcon size={28} /> : <GarlicIcon size={28} />}
          onClick={() => onAction(card, isProtected ? 'ungarlic' : 'garlic')}
        />
      </div>
    </li>
  );
}
