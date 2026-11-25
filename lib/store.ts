// The only module that touches browser.storage.local.
// Local-first: no synced storage and no network calls here.
import { browser } from 'wxt/browser';
import { DEFAULT_THEME, isEnabledThemeId, type ThemeId } from './themes';

export interface Stats {
  staked: number;
  coffined: number;
  crypted: number;
  dawns: number;
  mbFreed: number;
}

/** What the log records. Removing garlic is logged as 'garlic' too. */
export type LogAction = 'stake' | 'coffin' | 'crypt' | 'dawn' | 'resurrect' | 'garlic';
export const LOG_ACTIONS: readonly LogAction[] = ['stake', 'coffin', 'crypt', 'dawn', 'resurrect', 'garlic'];
export interface LogEntry {
  at: number;
  action: LogAction;
  site: string | null;
  title?: string;
}

export interface CryptEntry {
  id: string;
  url: string;
  title: string;
  savedAt: number;
}

/** A page in the row under the search box (a "haunt"). */
export interface Haunt {
  url: string;
  title: string;
}
/** The most haunts the row can hold. */
export const MAX_HAUNTS = 10;

export type { ThemeId };

export const KEYS = {
  stats: 'tabpire:stats',
  log: 'tabpire:log',
  crypt: 'tabpire:crypt',
  garlic: 'tabpire:garlic',
  haunts: 'tabpire:haunts',
  /** The key haunts were saved under before they were renamed. Read once as a fallback. */
  legacyPinned: 'tabpire:pinned',
  theme: 'tabpire:theme',
} as const;

export { DEFAULT_THEME };

const defaultStats = (): Stats => ({
  staked: 0,
  coffined: 0,
  crypted: 0,
  dawns: 0,
  mbFreed: 0,
});

// ---------- validators ----------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

const isStats = (v: unknown): v is Stats =>
  isRecord(v) &&
  isNum(v.staked) &&
  isNum(v.coffined) &&
  isNum(v.crypted) &&
  isNum(v.dawns) &&
  isNum(v.mbFreed);

const isLogAction = (v: unknown): v is LogAction => LOG_ACTIONS.includes(v as LogAction);
const isLogEntry = (v: unknown): v is LogEntry =>
  isRecord(v) &&
  isNum(v.at) &&
  isLogAction(v.action) &&
  (v.site === null || isStr(v.site)) &&
  (v.title === undefined || isStr(v.title));

const isCryptItem = (v: unknown): v is CryptEntry =>
  isRecord(v) && isStr(v.id) && isStr(v.url) && isStr(v.title) && isNum(v.savedAt);

const isHaunt = (v: unknown): v is Haunt =>
  isRecord(v) && isStr(v.url) && isStr(v.title);

const arrayOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

// ---------- read and write ----------

/** Missing or wrong-shaped values give the default. Storage errors propagate. */
async function read<T>(
  key: string,
  guard: (v: unknown) => v is T,
  fallback: () => T,
): Promise<T> {
  const result = await browser.storage.local.get(key);
  const value: unknown = result[key];
  return guard(value) ? value : fallback();
}

async function write(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export const store = {
  getStats: () => read(KEYS.stats, isStats, defaultStats),
  setStats: (v: Stats) => write(KEYS.stats, v),

  /** Entries saved by older versions with action 'ungarlic' are read as 'garlic'. */
  getLog: async (): Promise<LogEntry[]> => {
    const result = await browser.storage.local.get(KEYS.log);
    const value: unknown = result[KEYS.log];
    if (!Array.isArray(value)) return [];
    const fixed = value.map((e) => (isRecord(e) && e.action === 'ungarlic' ? { ...e, action: 'garlic' } : e));
    return arrayOf(isLogEntry)(fixed) ? fixed : [];
  },
  setLog: (v: LogEntry[]) => write(KEYS.log, v),

  getCrypt: () => read(KEYS.crypt, arrayOf(isCryptItem), () => []),
  setCrypt: (v: CryptEntry[]) => write(KEYS.crypt, v),

  getGarlic: () => read(KEYS.garlic, arrayOf(isStr), () => []),
  setGarlic: (v: string[]) => write(KEYS.garlic, v),

  getHaunts: async (): Promise<Haunt[]> => {
    const now = (await browser.storage.local.get(KEYS.haunts))[KEYS.haunts];
    if (arrayOf(isHaunt)(now)) return now;
    const old = (await browser.storage.local.get(KEYS.legacyPinned))[KEYS.legacyPinned];
    return arrayOf(isHaunt)(old) ? old : [];
  },
  setHaunts: (v: Haunt[]) => write(KEYS.haunts, v),

  /** An unknown, missing or unreadable value gives the default theme. Never throws. */
  getTheme: async (): Promise<ThemeId> => {
    try {
      return await read(KEYS.theme, isEnabledThemeId, () => DEFAULT_THEME);
    } catch {
      return DEFAULT_THEME;
    }
  },
  setTheme: (v: ThemeId) => write(KEYS.theme, v),
};

// ---------- transactions ----------

const LOCK_NAME = 'tabpire-store';
let chain: Promise<unknown> = Promise.resolve();

/**
 * Runs fn while holding a lock, so read-modify-write sequences do not lose
 * updates. Uses Web Locks (shared by every extension page and the background
 * script) and falls back to a promise chain inside one context.
 * fn must not call transact again: it would wait on its own lock.
 */
export function transact<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks) return locks.request(LOCK_NAME, () => fn()) as Promise<T>;
  const next: Promise<T> = chain.then(fn, fn);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

// ---------- change notifications ----------

/**
 * Calls listener with the changed Tabpire keys, for local storage only.
 * Lets one page react to writes made by another. Returns an unsubscribe function.
 */
export function onStoreChange(listener: (changedKeys: string[]) => void): () => void {
  const handler = (changes: Record<string, unknown>, area: string) => {
    if (area !== 'local') return;
    const keys = Object.keys(changes).filter((k) => k.startsWith('tabpire:'));
    if (keys.length > 0) listener(keys);
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
