// Search-box suggestions: the user's own tabs, pinned pages and crypt first, then web suggestions.
import type { TabLike } from './hunger';
import { hostOf } from './hunger';
import type { CryptEntry, Haunt } from './store';

export type Suggestion =
  | { kind: 'tab'; title: string; url: string; tabId: number; icon?: string }
  | { kind: 'page'; title: string; url: string }
  | { kind: 'crypt'; title: string; url: string; icon?: string }
  | { kind: 'web'; text: string };

const MAX_LOCAL = 4;
const MAX_WEB = 8;

/** Matches every word of the query against the title or address, case-insensitively. */
function matches(query: string, ...fields: string[]) {
  const hay = fields.join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function localSuggestions(query: string, tabs: TabLike[], pages: Haunt[], crypt: CryptEntry[]): Suggestion[] {
  const q = query.trim();
  if (!q) return [];
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  const add = (s: Suggestion & { url: string }) => {
    if (seen.has(s.url) || out.length >= MAX_LOCAL) return;
    seen.add(s.url);
    out.push(s);
  };
  for (const t of tabs) if (matches(q, t.title, t.url)) add({ kind: 'tab', title: t.title, url: t.url, tabId: t.id, icon: t.favIconUrl });
  for (const p of pages) if (matches(q, p.title, p.url)) add({ kind: 'page', title: p.title, url: p.url });
  for (const c of crypt) if (matches(q, c.title, c.url)) add({ kind: 'crypt', title: c.title, url: c.url, icon: c.favIconUrl });
  return out;
}

// Overridable so the web demo can route through its dev-server proxy (no CORS there).
const SUGGEST_BASE = (import.meta.env.VITE_SUGGEST_BASE as string | undefined) ?? 'https://suggestqueries.google.com';

/** Popular searches for the query from Google's suggestion service (the same one the address bar uses). */
export async function webSuggestions(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`${SUGGEST_BASE}/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[]];
    return (data[1] ?? []).slice(0, MAX_WEB).map((text) => ({ kind: 'web' as const, text }));
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
    return []; // offline: the typed query itself is still offered
  }
}

/**
 * What the dropdown shows for the web: the query itself first (so anything you type
 * is searchable, the way Google's box works), then completions that still match it.
 */
export function webSuggestionsFor(query: string, fetched: Suggestion[]): Suggestion[] {
  const q = query.trim();
  if (!q) return [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const seen = new Set<string>([q.toLowerCase()]);
  const rest: Suggestion[] = [];
  for (const s of fetched) {
    if (s.kind !== 'web') continue;
    const text = s.text.trim();
    const low = text.toLowerCase();
    if (!text || seen.has(low) || !words.every((w) => low.includes(w))) continue;
    seen.add(low);
    rest.push({ kind: 'web', text });
    if (rest.length >= MAX_WEB) break;
  }
  return [{ kind: 'web', text: q }, ...rest];
}

export function suggestionLabel(s: Suggestion) {
  return s.kind === 'web' ? s.text : s.title || hostOf(s.url);
}
