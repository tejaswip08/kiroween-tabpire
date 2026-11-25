// Pure view logic for The Crypt page. No browser APIs.
import {
  DAY_MS,
  estimateMb,
  formatIdle,
  hungerMs,
  siteOf,
  stateOf,
  type TabInfo,
  type VampireState,
} from './hunger';

export interface RawTab {
  id: number;
  windowId: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  pinned: boolean;
  lastAccessed?: number;
}

export interface Card {
  tab: RawTab;
  info: TabInfo;
  site: string | null;
  state: VampireState;
  hungerMs: number;
  mb: number;
}

export const VIAL_FULL_MS = 3 * DAY_MS;
/** Where the Starving line (1 day) sits on the vial, from 0 to 1. */
export const VIAL_TICK = DAY_MS / VIAL_FULL_MS;


const BLANK_PAGES = [
  'chrome://newtab/',
  'chrome://newtab',
  'edge://newtab/',
  'edge://newtab',
  'about:newtab',
  'about:home',
  'about:blank',
];

/** Shape of a browser tab, as far as this module cares. */
interface TabLike {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  active?: boolean;
  audible?: boolean;
  discarded?: boolean;
  pinned?: boolean;
  lastAccessed?: number;
}

export function toRawTab(tab: TabLike): RawTab | null {
  if (tab.id === undefined) return null;
  return {
    id: tab.id,
    windowId: tab.windowId ?? -1,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    active: tab.active === true,
    audible: tab.audible === true,
    discarded: tab.discarded === true,
    pinned: tab.pinned === true,
    lastAccessed: tab.lastAccessed,
  };
}

export function toInfo(tab: RawTab): TabInfo {
  return {
    id: tab.id,
    url: tab.url,
    active: tab.active,
    audible: tab.audible,
    discarded: tab.discarded,
    pinned: tab.pinned,
    lastAccessed: tab.lastAccessed,
  };
}

/** A tab gets a card unless it is this page, another Tabpire page, or a blank new tab. */
export function isCardTab(
  tab: RawTab,
  currentTabId: number | undefined,
  ownPrefix: string,
): boolean {
  if (tab.id === currentTabId) return false;
  const url = tab.url ?? '';
  if (ownPrefix !== '' && url.startsWith(ownPrefix)) return false;
  if (BLANK_PAGES.includes(url)) return false;
  return true;
}

/** Cards for every other tab, in `compareCards` order. */
export function buildCards(
  tabs: readonly RawTab[],
  currentTabId: number | undefined,
  ownPrefix: string,
  garlic: readonly string[],
  now: number,
): Card[] {
  return tabs
    .filter((t) => isCardTab(t, currentTabId, ownPrefix))
    .map((tab): Card => {
      const info = toInfo(tab);
      return {
        tab,
        info,
        site: siteOf(tab.url),
        state: stateOf(info, garlic, now),
        hungerMs: hungerMs(info, now),
        mb: estimateMb(info),
      };
    })
    .sort(compareCards);
}
/** Card order by state: the ones to deal with first. */
export const STATE_ORDER: readonly VampireState[] = ['starving', 'awake', 'asleep', 'protected'];
/**
 * Starving first, then awake (the tab in use or playing sound first, then the rest), then asleep, then protected.
 * Inside a state the longest idle comes first; ties keep the tab id order.
 */
export function compareCards(a: Card, b: Card): number {
  const byState = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
  if (byState !== 0) return byState;
  if (a.state === 'awake') {
    const inUse = (c: Card) => (c.info.active || c.info.audible ? 0 : 1);
    const byUse = inUse(a) - inUse(b);
    if (byUse !== 0) return byUse;
  }
  return b.hungerMs - a.hungerMs || a.tab.id - b.tab.id;
}


export function idleLabel(card: Pick<Card, 'info' | 'hungerMs'>): string {
  const { info, hungerMs: ms } = card;
  if (info.active || info.audible) return 'In use now';
  if (info.lastAccessed === undefined) return 'Idle time unknown';
  return formatIdle(ms);
}
/** Vial fill from 0 to 1. Full at 3 days idle. */
export function vialFill(ms: number): number {
  return Math.min(1, Math.max(0, ms / VIAL_FULL_MS));
}

export function sumMb(cards: readonly Pick<Card, 'mb'>[]): number {
  return cards.reduce((sum, c) => sum + c.mb, 0);
}
