// The only module that touches browser.storage (local and sync).
// Settings (theme, haunts, garlic) live in storage.sync, so the browser account carries them between devices.
// The crypt, log and stats stay in storage.local (too big for the sync limits). No network calls here.
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
  /** The memory this entry reclaimed (an estimate). Missing for entries that freed nothing and for older entries. */
  mb?: number;
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
  /** Local flag: the cards are hidden ("Hide tabs") so the whole 3D scene shows. */
  cardsHidden: 'tabpire:cards-hidden',
  /** Local flag: the one-time copy of settings from local to sync has finished. */
  syncMigrated: 'tabpire:sync-migrated',
} as const;

/** The settings that follow the user's browser account. */
const SYNC_KEYS: readonly string[] = [KEYS.theme, KEYS.haunts, KEYS.garlic];

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
  (v.title === undefined || isStr(v.title)) &&
  (v.mb === undefined || isNum(v.mb));

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

// ---------- synced settings ----------
// A synced key is held in storage.sync. storage.local holds it only when sync is unavailable or a write
// to sync failed (quota, sync turned off), so a local value is the newest value on this device.
// Reads look at local first, then sync. A successful sync write removes the local copy.

/** The sync area, or null where the browser has none. */
function syncArea(): typeof browser.storage.local | null {
  try {
    const area = (browser.storage as unknown as { sync?: typeof browser.storage.local }).sync;
    return area ?? null;
  } catch {
    return null;
  }
}

async function dropLocal(key: string): Promise<void> {
  try {
    const has = key in (await browser.storage.local.get(key));
    if (has) await browser.storage.local.remove(key);
  } catch {
    /* the local copy stays and is read first: still the newest value on this device */
  }
}

let migration: Promise<void> | null = null;

/**
 * Copies settings saved by older versions from local to sync, once.
 * A value already in sync wins (another device saved it). Any failure leaves the local copy and retries next run.
 */
function migrateToSync(): Promise<void> {
  const sync = syncArea();
  if (!sync) return Promise.resolve();
  migration ??= (async () => {
    try {
      const flagged = (await browser.storage.local.get(KEYS.syncMigrated))[KEYS.syncMigrated];
      if (flagged === true) return;
      const keys = [...SYNC_KEYS, KEYS.legacyPinned];
      const local = await browser.storage.local.get(keys);
      const remote = await sync.get([...SYNC_KEYS]);
      let complete = true;
      for (const key of SYNC_KEYS) {
        const legacy = key === KEYS.haunts && local[key] === undefined ? KEYS.legacyPinned : key;
        const value: unknown = local[legacy];
        if (value !== undefined && remote[key] === undefined) {
          try {
            await sync.set({ [key]: value });
          } catch {
            complete = false;
            continue;
          }
        }
        if (local[key] !== undefined) await dropLocal(key);
      }
      if (complete) await write(KEYS.syncMigrated, true);
    } catch {
      /* sync is off or unreadable: try again on the next run */
    }
    if (!(await migrated())) migration = null;
  })();
  return migration;
}

async function migrated(): Promise<boolean> {
  try {
    return (await browser.storage.local.get(KEYS.syncMigrated))[KEYS.syncMigrated] === true;
  } catch {
    return false;
  }
}

/** Reads a synced setting: this device's local fallback copy first, then sync. */
async function readSynced<T>(key: string, guard: (v: unknown) => v is T, fallback: () => T): Promise<T> {
  await migrateToSync();
  const local = (await browser.storage.local.get(key))[key];
  if (guard(local)) return local;
  const sync = syncArea();
  if (sync) {
    try {
      const remote = (await sync.get(key))[key];
      if (guard(remote)) return remote;
    } catch {
      /* sync unreadable: use the default */
    }
  }
  return fallback();
}

/** Writes a synced setting to sync, or to local when sync is unavailable or the write fails. */
async function writeSynced(key: string, value: unknown): Promise<void> {
  await migrateToSync();
  const sync = syncArea();
  if (sync) {
    try {
      await sync.set({ [key]: value });
      await dropLocal(key);
      return;
    } catch {
      /* quota or sync off: fall back silently */
    }
  }
  await write(key, value);
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

  getGarlic: () => readSynced(KEYS.garlic, arrayOf(isStr), () => []),
  setGarlic: (v: string[]) => writeSynced(KEYS.garlic, v),

  getHaunts: async (): Promise<Haunt[]> => {
    const now = await readSynced<Haunt[] | null>(KEYS.haunts, (v): v is Haunt[] | null => v === null || arrayOf(isHaunt)(v), () => null);
    if (now) return now;
    const old = (await browser.storage.local.get(KEYS.legacyPinned))[KEYS.legacyPinned];
    return arrayOf(isHaunt)(old) ? old : [];
  },
  setHaunts: (v: Haunt[]) => writeSynced(KEYS.haunts, v),

  /** An unknown, missing or unreadable value gives the default theme. Never throws. */
  getTheme: async (): Promise<ThemeId> => {
    try {
      return await readSynced(KEYS.theme, isEnabledThemeId, () => DEFAULT_THEME);
    } catch {
      return DEFAULT_THEME;
    }
  },
  setTheme: (v: ThemeId) => writeSynced(KEYS.theme, v),
  /** Whether the cards are hidden. Missing or unreadable gives false (cards shown). Never throws. */
  getCardsHidden: async (): Promise<boolean> => {
    try {
      return await read(KEYS.cardsHidden, (v): v is boolean => typeof v === 'boolean', () => false);
    } catch {
      return false;
    }
  },
  setCardsHidden: (v: boolean) => write(KEYS.cardsHidden, v),
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
 * Calls listener with the changed Tabpire keys: any key from local storage, and the synced settings from
 * sync storage (a change made on another device). Lets one page react to writes made by another. Returns an unsubscribe function.
 */
export function onStoreChange(listener: (changedKeys: string[]) => void): () => void {
  const handler = (changes: Record<string, unknown>, area: string) => {
    if (area !== 'local' && area !== 'sync') return;
    const keys = Object.keys(changes).filter(
      (k) => k.startsWith('tabpire:') && (area === 'local' || SYNC_KEYS.includes(k)),
    );
    if (keys.length > 0) listener(keys);
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
