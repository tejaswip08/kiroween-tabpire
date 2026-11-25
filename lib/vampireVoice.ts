// What a vampire says about its tab, and plain sentences that explain each state. Pure: no DOM, no clock.
import { DAY_MS, type TabInfo, type VampireState } from './hunger';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** The label shown for each state (the page makes it upper case). */
export const STATE_LABEL: Record<VampireState, string> = {
  awake: 'Awake',
  starving: 'Starving',
  asleep: 'Asleep',
  protected: 'Protected',
};
/** The states in the order they are listed. */
export const STATE_ORDER: readonly VampireState[] = ['awake', 'starving', 'asleep', 'protected'];
/** The small grey hint beside each state in the legend. */
export const STATE_HINT: Record<VampireState, string> = {
  awake: 'used < 1 day',
  starving: 'idle 1 day+',
  asleep: 'in a coffin',
  protected: 'garlic',
};
/** One plain sentence that says what each state means. */
export const STATE_EXPLANATION: Record<VampireState, string> = {
  awake: 'Used in the last day. As the hours pass it slowly turns grey, and after a full day without a visit it starts starving.',
  starving: 'Not used for a day or more. It keeps using memory while it waits. Visit it, put it to sleep, or close it.',
  asleep: 'Put to sleep in a coffin. The browser has freed its memory, and it wakes when you open it.',
  protected: 'Garlic keeps every tab on this site safe. It is never counted as starving, and Dawn leaves it alone.',
};

type Timing = Pick<TabInfo, 'active' | 'audible' | 'lastAccessed'>;
const inUse = (t: Timing) => t.active || t.audible;

/** How hungry a vampire is, from 0 to 1. It is full at one day idle, which is when a tab becomes Starving. */
export function hungerShare(ms: number): number {
  return Number.isFinite(ms) ? Math.min(1, Math.max(0, ms / DAY_MS)) : 0;
}
export function hungerPercent(ms: number): number {
  return Math.round(hungerShare(ms) * 100);
}

/** A short idle time: "now", "<1 min", "25 min", "17 h" or "3 d". */
export function shortAge(ms: number, t: Timing): string {
  if (inUse(t)) return 'now';
  if (t.lastAccessed === undefined) return '?';
  if (ms < MINUTE) return '<1 min';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR)} h`;
  return `${Math.floor(ms / DAY_MS)} d`;
}

/** The "Last used" line of the popup. */
export function lastUsedText(ms: number, t: Timing): string {
  if (inUse(t)) return 'In use now';
  if (t.lastAccessed === undefined) return 'Unknown';
  if (ms < MINUTE) return 'Just now';
  return `${shortAge(ms, t)} ago`;
}
// The vampire's own lines (the card hover quote and every tip) are in lib/tips.ts.
