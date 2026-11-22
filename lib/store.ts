// The only module that touches browser.storage.local.
// Local-first: no synced storage and no network calls here.
import { browser } from 'wxt/browser';

export interface Stats {
  staked: number;
  coffined: number;
  crypted: number;
  dawns: number;
  mbFreed: number;
}

export interface ActionLogEntry {
  at: number;
  action: string;
  site: string | null;
  title?: string;
}

export interface CryptItem {
  id: string;
  url: string;
  title: string;
  savedAt: number;
}

export interface PinnedPage {
  url: string;
  title: string;
}

export type ThemeId = string;

export const KEYS = {
  stats: 'tabpire:stats',
  log: 'tabpire:log',
  crypt: 'tabpire:crypt',
  garlic: 'tabpire:garlic',
  pinned: 'tabpire:pinned',
  theme: 'tabpire:theme',
} as const;

export const DEFAULT_THEME: ThemeId = 'crypt';

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

const isLogEntry = (v: unknown): v is ActionLogEntry =>
  isRecord(v) &&
  isNum(v.at) &&
  isStr(v.action) &&
  (v.site === null || isStr(v.site)) &&
  (v.title === undefined || isStr(v.title));

const isCryptItem = (v: unknown): v is CryptItem =>
  isRecord(v) && isStr(v.id) && isStr(v.url) && isStr(v.title) && isNum(v.savedAt);

const isPinned = (v: unknown): v is PinnedPage =>
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

  getLog: () => read(KEYS.log, arrayOf(isLogEntry), () => []),
  setLog: (v: ActionLogEntry[]) => write(KEYS.log, v),

  getCrypt: () => read(KEYS.crypt, arrayOf(isCryptItem), () => []),
  setCrypt: (v: CryptItem[]) => write(KEYS.crypt, v),

  getGarlic: () => read(KEYS.garlic, arrayOf(isStr), () => []),
  setGarlic: (v: string[]) => write(KEYS.garlic, v),

  getPinned: () => read(KEYS.pinned, arrayOf(isPinned), () => []),
  setPinned: (v: PinnedPage[]) => write(KEYS.pinned, v),

  getTheme: () => read(KEYS.theme, isStr, () => DEFAULT_THEME),
  setTheme: (v: ThemeId) => write(KEYS.theme, v),
};
