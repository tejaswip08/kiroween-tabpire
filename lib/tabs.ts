// Browser-side tab reading and the hunter's actions.
import { browser } from 'wxt/browser';
import { appetiteMb, dawnTargets, hostOf, type TabLike } from './hunger';
import { load, record, save } from './store';

const OWN_ORIGIN = browser.runtime.getURL('/');

function isOwnPage(url: string): boolean {
  return url.startsWith(OWN_ORIGIN) || url.startsWith('chrome://newtab') || url === 'about:newtab';
}

export async function readTabs(): Promise<TabLike[]> {
  const tabs = await browser.tabs.query({});
  return tabs
    .filter((t) => t.id !== undefined && !isOwnPage(t.url ?? t.pendingUrl ?? ''))
    .map((t) => ({
      id: t.id!,
      url: t.url ?? '',
      title: t.title || t.url || 'Untitled',
      favIconUrl: t.favIconUrl,
      lastAccessed: t.lastAccessed ?? Date.now(),
      active: t.active,
      audible: !!t.audible,
      discarded: !!t.discarded,
      pinned: t.pinned,
    }));
}

/** Current time, shifted by the dev-only time warp. */
export async function now(): Promise<number> {
  const { timeWarpMs } = await load();
  return Date.now() + (import.meta.env.DEV ? timeWarpMs : 0);
}

export async function stake(tab: TabLike): Promise<void> {
  const mb = appetiteMb(tab);
  await browser.tabs.remove(tab.id);
  await record({ action: 'stake', title: tab.title, url: tab.url, mb }, { staked: 1, reclaimedMb: mb });
}

export async function coffin(tab: TabLike): Promise<void> {
  const mb = appetiteMb(tab);
  if (tab.active) {
    // Chrome can't discard the active tab; nothing to free.
    return;
  }
  await browser.tabs.discard(tab.id);
  await record({ action: 'coffin', title: tab.title, url: tab.url, mb }, { coffined: 1, reclaimedMb: mb });
}

export async function wake(tab: TabLike): Promise<void> {
  await browser.tabs.update(tab.id, { active: true });
}

export async function crypt(tab: TabLike): Promise<void> {
  const mb = appetiteMb(tab);
  await browser.tabs.remove(tab.id);
  await record(
    { action: 'crypt', title: tab.title, url: tab.url, mb },
    { crypted: 1, reclaimedMb: mb },
    [{ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl, at: Date.now() }],
  );
}

export async function toggleGarlic(url: string): Promise<void> {
  const host = hostOf(url);
  if (!host) return;
  const { garlic } = await load();
  await save({ garlic: garlic.includes(host) ? garlic.filter((h) => h !== host) : [...garlic, host] });
}

/** Burn every starving vampire to dust, saving each one to the Crypt. */
export async function dawn(tabs: TabLike[]): Promise<number> {
  const { garlic } = await load();
  const targets = dawnTargets(tabs, await now(), new Set(garlic));
  if (targets.length === 0) return 0;
  await browser.tabs.remove(targets.map((t) => t.id));
  const mb = targets.reduce((sum, t) => sum + appetiteMb(t), 0);
  await record(
    { action: 'dawn', title: `Dawn burned ${targets.length}`, mb, count: targets.length },
    { dawns: 1, crypted: targets.length, reclaimedMb: mb },
    targets.map((t) => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl, at: Date.now() })),
  );
  return targets.length;
}

export async function resurrect(url: string): Promise<void> {
  const s = await load();
  const entry = s.crypt.find((c) => c.url === url);
  await browser.tabs.create({ url, active: false });
  await save({ crypt: s.crypt.filter((c) => c !== entry) });
  await record({ action: 'resurrect', title: entry?.title ?? url, url, mb: 0 }, {});
}

/** From the popup this opens a new tab; from an extension page it navigates in place so Back works. */
export function openBloodBank({ sameTab = false } = {}): void {
  const url = browser.runtime.getURL('/bloodbank.html');
  if (sameTab) location.assign(url);
  else browser.tabs.create({ url });
}

export function openCrypt(): void {
  location.assign(browser.runtime.getURL('/newtab.html'));
}

/** Looks like an address the user wants to open directly (e.g. "github.com", "localhost:3000"). */
export function asUrl(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(t)) return `http://${t}`;
  if (/^[^./]+(\.[^./]+)+(:\d+)?(\/.*)?$/.test(t) && /\.[a-z]{2,}(:\d+)?(\/|$)/i.test(t)) return `https://${t}`;
  return null;
}

/** Search with the browser's default search engine, or open the address if it is one. */
export async function searchWeb(text: string): Promise<void> {
  const query = text.trim();
  if (!query) return;
  const url = asUrl(query);
  if (url) return location.assign(url);
  const api = (browser as unknown as {
    search?: { query?: (o: { text: string; disposition: string }) => Promise<void>; search?: (o: { query: string }) => Promise<void> };
  }).search;
  try {
    if (api?.query) return await api.query({ text: query, disposition: 'CURRENT_TAB' }); // Chrome
    if (api?.search) return await api.search({ query }); // Firefox
  } catch {
    // The browser search API can reject; still take the user to results.
  }
  location.assign(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
}
