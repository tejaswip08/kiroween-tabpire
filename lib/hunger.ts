// Pure tab rules. No browser APIs and no clock: time is always passed in.

export type VampireState = 'awake' | 'starving' | 'asleep' | 'protected';

export interface TabInfo {
  /** Stable per tab while the browser session lives. */
  id: number;
  url?: string;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  pinned: boolean;
  /** Epoch milliseconds of last use. Absent when unknown. */
  lastAccessed?: number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Hostname without a leading "www.", for http and https URLs only. */
export function siteOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return host === '' ? null : host;
  } catch {
    return null;
  }
}

/** Idle time in milliseconds. Never negative. */
export function hungerMs(tab: TabInfo, now: number): number {
  if (tab.active || tab.audible) return 0;
  if (tab.lastAccessed === undefined) return 0;
  return Math.max(0, now - tab.lastAccessed);
}

/** Every tab gets exactly one state. First matching rule wins. */
export function stateOf(
  tab: TabInfo,
  garlic: readonly string[],
  now: number,
): VampireState {
  const site = siteOf(tab.url);
  if (site !== null && garlic.includes(site)) return 'protected';
  if (tab.discarded) return 'asleep';
  if (tab.active || tab.audible) return 'awake';
  if (tab.lastAccessed === undefined) return 'awake';
  if (now - tab.lastAccessed >= DAY_MS) return 'starving';
  return 'awake';
}

/** Tabs Dawn may close: starving, not pinned, and with an http(s) URL. */
export function isDawnTarget(
  tab: TabInfo,
  garlic: readonly string[],
  now: number,
): boolean {
  return (
    siteOf(tab.url) !== null &&
    !tab.pinned &&
    stateOf(tab, garlic, now) === 'starving'
  );
}

export function dawnTargets<T extends TabInfo>(
  tabs: readonly T[],
  garlic: readonly string[],
  now: number,
): T[] {
  return tabs.filter((t) => isDawnTarget(t, garlic, now));
}

export function countStarving(
  tabs: readonly TabInfo[],
  garlic: readonly string[],
  now: number,
): number {
  return tabs.filter((t) => stateOf(t, garlic, now) === 'starving').length;
}

/** Toolbar badge text: empty for none, "999+" above 999. */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > 999 ? '999+' : String(count);
}

/** Approximate memory in MB for known sites. */
export const KNOWN_SITE_MB: Readonly<Record<string, number>> = {
  'chatgpt.com': 520,
  'claude.ai': 450,
  'youtube.com': 350,
  'figma.com': 400,
  'mail.google.com': 300,
  'docs.google.com': 250,
  'notion.so': 300,
  'slack.com': 280,
  'discord.com': 300,
  'github.com': 180,
  'netflix.com': 400,
  'twitter.com': 250,
  'x.com': 250,
  'linkedin.com': 220,
  'meet.google.com': 450,
};

const INTERNAL_PAGE_MB = 80;
const MEDIA_MB = 300;
const APP_MB = 250;
const GENERIC_PAGE_MB = 150;

const MEDIA_WORDS = ['video', 'watch', 'stream', 'maps'];
const APP_WORDS = ['docs', 'mail', 'app', 'drive', 'notion'];

/** Base size for a site: exact hostname or parent-domain match, longest wins. */
function knownBase(site: string): number | null {
  let bestKey: string | null = null;
  for (const key of Object.keys(KNOWN_SITE_MB)) {
    if (site === key || site.endsWith(`.${key}`)) {
      if (bestKey === null || key.length > bestKey.length) bestKey = key;
    }
  }
  return bestKey === null ? null : (KNOWN_SITE_MB[bestKey] ?? null);
}

function heuristicBase(tab: TabInfo, site: string | null): number {
  if (site === null) return INTERNAL_PAGE_MB;
  let path = '';
  try {
    path = new URL(tab.url ?? '').pathname;
  } catch {
    // site is non-null, so the URL parsed; this is unreachable in practice.
  }
  const words = `${site} ${path}`.toLowerCase().split(/[^a-z0-9]+/);
  if (MEDIA_WORDS.some((w) => words.includes(w))) return MEDIA_MB;
  if (APP_WORDS.some((w) => words.includes(w))) return APP_MB;
  return GENERIC_PAGE_MB;
}

/** 32-bit FNV-1a. Same input gives the same output on every platform. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Base size before the per-tab variation. 0 for discarded tabs. */
export function baseMb(tab: TabInfo): number {
  if (tab.discarded) return 0;
  const site = siteOf(tab.url);
  const known = site === null ? null : knownBase(site);
  return known ?? heuristicBase(tab, site);
}

/** Stable per-tab estimate in MB, rounded to 5, never negative. */
export function estimateMb(tab: TabInfo): number {
  const base = baseMb(tab);
  if (base === 0) return 0;
  const site = siteOf(tab.url);
  const hash = fnv1a32(`${tab.id}:${site ?? tab.url ?? ''}`);
  const factor = 0.85 + ((hash % 10001) / 10000) * 0.3;
  return Math.max(0, Math.round((base * factor) / 5) * 5);
}

/** Display text. Always starts with "~" because the number is an estimate. */
export function formatMb(mb: number): string {
  return `~${mb} MB`;
}
