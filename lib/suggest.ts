// Search suggestions. Pure: matching and merging only.
import type { CryptItem, PinnedPage } from './store';
import type { RawTab } from './view';

export type SuggestionKind = 'tab' | 'pinned' | 'crypt' | 'search';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  label: string;
  detail?: string;
  tabId?: number;
  windowId?: number;
  url?: string;
  cryptId?: string;
  text?: string;
}

export const KIND_LABEL: Record<SuggestionKind, string> = {
  tab: 'Open tab',
  pinned: 'Pinned page',
  crypt: 'Crypt',
  search: 'Search',
};

export const MAX_PER_GROUP = 3;
export const MAX_WEB = 5;

/** Higher is better. 0 means no match. */
function score(words: string[], title: string, url: string): number {
  const t = title.toLowerCase();
  const u = url.toLowerCase();
  const hay = `${t} ${u}`;
  if (!words.every((w) => hay.includes(w))) return 0;
  const first = words[0] ?? '';
  if (t.startsWith(first)) return 3;
  if (t.includes(first)) return 2;
  return 1;
}

function top<T>(items: T[], scoreOf: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, s: scoreOf(item), index }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .slice(0, MAX_PER_GROUP)
    .map((x) => x.item);
}

export function localSuggestions(
  query: string,
  src: { tabs: readonly RawTab[]; pinned: readonly PinnedPage[]; crypt: readonly CryptItem[] },
): Suggestion[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const tabs = top([...src.tabs], (t) => score(words, t.title ?? '', t.url ?? '')).map(
    (t): Suggestion => ({
      id: `tab:${t.id}`,
      kind: 'tab',
      label: t.title || t.url || 'Untitled tab',
      detail: t.url,
      tabId: t.id,
      windowId: t.windowId,
    }),
  );
  const pinned = top([...src.pinned], (p) => score(words, p.title, p.url)).map(
    (p): Suggestion => ({ id: `pinned:${p.url}`, kind: 'pinned', label: p.title, detail: p.url, url: p.url }),
  );
  const crypt = top([...src.crypt], (c) => score(words, c.title, c.url)).map(
    (c): Suggestion => ({
      id: `crypt:${c.id}`,
      kind: 'crypt',
      label: c.title,
      detail: c.url,
      url: c.url,
      cryptId: c.id,
    }),
  );
  return [...tabs, ...pinned, ...crypt];
}

/** Adds up to five distinct web suggestions after the local ones. */
export function withWeb(local: readonly Suggestion[], web: readonly string[], query: string): Suggestion[] {
  const seen = new Set<string>([query.trim().toLowerCase()]);
  const extra: Suggestion[] = [];
  for (const raw of web) {
    const text = raw.trim();
    const key = text.toLowerCase();
    if (text === '' || seen.has(key)) continue;
    seen.add(key);
    extra.push({ id: `search:${text}`, kind: 'search', label: text, text });
    if (extra.length === MAX_WEB) break;
  }
  return [...local, ...extra];
}

/** Reads the `["query", ["a", "b"]]` shape. Anything else gives an empty list. */
export function parseGoogleResponse(json: unknown): string[] {
  if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
  return json[1].filter((x): x is string => typeof x === 'string');
}
