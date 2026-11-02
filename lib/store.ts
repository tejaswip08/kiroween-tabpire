// Everything Tabpire remembers lives in browser.storage.local. Nothing leaves the browser.
import { browser } from 'wxt/browser';

export interface Stats {
  reclaimedMb: number;
  staked: number;
  coffined: number;
  crypted: number;
  dawns: number;
}

export type LogAction = 'stake' | 'coffin' | 'crypt' | 'dawn' | 'resurrect' | 'garlic';

export interface LogEntry {
  at: number;
  action: LogAction;
  title: string;
  url?: string;
  mb: number;
  count?: number;
}

export interface CryptEntry {
  url: string;
  title: string;
  favIconUrl?: string;
  at: number;
}

/** A shortcut on the Crypt, like a browser new-tab tile. */
export interface Haunt {
  id: string;
  title: string;
  url: string;
  /** Site icon captured from an open tab when the page was added, if one was open. */
  icon?: string;
}

interface Shape {
  haunts: Haunt[];
  stats: Stats;
  log: LogEntry[];
  crypt: CryptEntry[];
  garlic: string[];
  timeWarpMs: number;
}

const DEFAULTS: Shape = {
  haunts: [],
  stats: { reclaimedMb: 0, staked: 0, coffined: 0, crypted: 0, dawns: 0 },
  log: [],
  crypt: [],
  garlic: [],
  timeWarpMs: 0,
};

const MAX_LOG = 500;

export async function load(): Promise<Shape> {
  const raw = await browser.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...(raw as Partial<Shape>) };
}

export async function save(patch: Partial<Shape>): Promise<void> {
  await browser.storage.local.set(patch);
}

export async function record(
  entry: Omit<LogEntry, 'at'>,
  statsDelta: Partial<Stats>,
  cryptAdd: CryptEntry[] = [],
): Promise<void> {
  const s = await load();
  const stats = { ...s.stats };
  for (const [k, v] of Object.entries(statsDelta) as [keyof Stats, number][]) stats[k] += v;
  await save({
    stats,
    log: [{ ...entry, at: Date.now() }, ...s.log].slice(0, MAX_LOG),
    crypt: [...cryptAdd, ...s.crypt],
  });
}

export function onStoreChange(cb: () => void): () => void {
  const listener = () => cb();
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export const MAX_HAUNTS = 10;

export async function saveHaunt(h: Omit<Haunt, 'id'> & { id?: string }): Promise<void> {
  const { haunts } = await load();
  if (h.id) {
    await save({ haunts: haunts.map((x) => (x.id === h.id ? { ...x, title: h.title, url: h.url, icon: h.icon } : x)) });
  } else if (haunts.length < MAX_HAUNTS) {
    await save({ haunts: [...haunts, { id: crypto.randomUUID(), title: h.title, url: h.url, icon: h.icon }] });
  }
}

export async function removeHaunt(id: string): Promise<void> {
  const { haunts } = await load();
  await save({ haunts: haunts.filter((x) => x.id !== id) });
}
