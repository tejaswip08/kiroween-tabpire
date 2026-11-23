// Tab actions. The only module that changes tabs.
// All data goes through lib/store.ts.
import { browser } from 'wxt/browser';
import type { Browser } from 'wxt/browser';
import { refreshBadge } from './badge';
import { estimateMb, isDawnTarget, siteOf, dawnTargets } from './hunger';
import { store, transact, type LogAction, type Stats } from './store';
import { toTabInfo } from './tabinfo';

export { toTabInfo } from './tabinfo';

export const LOG_LIMIT = 200;

export type FailReason =
  | 'no-tab'
  | 'not-allowed'
  | 'no-site'
  | 'not-found'
  | 'save-failed'
  | 'browser-error';

export type ActionResult =
  | { ok: true; changed: boolean; mb: number }
  | { ok: false; reason: FailReason };

export type DawnResult =
  | { ok: true; closed: number; mb: number }
  | { ok: false; reason: FailReason };

export interface ActionRow {
  action: LogAction;
  site: string | null;
  title?: string;
  mb: number;
}

/** Writes stats and log together under one lock. */
export async function recordActions(
  rows: readonly ActionRow[],
  delta: Partial<Stats>,
  now: number,
): Promise<void> {
  await transact(async () => {
    const [stats, log] = await Promise.all([store.getStats(), store.getLog()]);
    const next: Stats = { ...stats };
    for (const key of Object.keys(delta) as (keyof Stats)[]) {
      next[key] += Math.max(0, delta[key] ?? 0);
    }
    next.mbFreed += rows.reduce((sum, r) => sum + Math.max(0, r.mb), 0);
    const entries = rows.map((r) => ({
      at: now,
      action: r.action,
      site: r.site,
      ...(r.title !== undefined ? { title: r.title } : {}),
    }));
    await store.setStats(next);
    await store.setLog([...log, ...entries].slice(-LOG_LIMIT));
  });
}

/** Badge refresh must never break an action. */
async function refreshBadgeQuietly(): Promise<void> {
  try {
    await refreshBadge();
  } catch {
    // The next alarm retries.
  }
}

async function getTab(tabId: number): Promise<Browser.tabs.Tab | null> {
  try {
    return await browser.tabs.get(tabId);
  } catch {
    return null;
  }
}

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });

/**
 * Called after the browser change has already happened. A failed write must
 * not report the action as failed, since the tab is already gone or discarded.
 */
async function finish(
  rows: readonly ActionRow[],
  delta: Partial<Stats>,
  now: number,
): Promise<void> {
  try {
    await recordActions(rows, delta, now);
  } catch {
    // The action itself succeeded.
  }
  await refreshBadgeQuietly();
}

const rowFor = (action: LogAction, tab: Browser.tabs.Tab, mb: number): ActionRow => ({
  action,
  site: siteOf(tab.url),
  ...(tab.title !== undefined ? { title: tab.title } : {}),
  mb,
});

/** Stake: close the tab. */
export async function stake(tabId: number, now: number = Date.now()): Promise<ActionResult> {
  const tab = await getTab(tabId);
  const info = tab ? toTabInfo(tab) : null;
  if (!tab || !info) return fail('no-tab');
  const mb = estimateMb(info);
  try {
    await browser.tabs.remove(tabId);
  } catch {
    return fail('browser-error');
  }
  await finish([rowFor('stake', tab, mb)], { staked: 1 }, now);
  return { ok: true, changed: true, mb };
}

/** Coffin: discard the tab to free memory. Active and already discarded tabs are refused. */
export async function coffin(tabId: number, now: number = Date.now()): Promise<ActionResult> {
  const tab = await getTab(tabId);
  const info = tab ? toTabInfo(tab) : null;
  if (!tab || !info) return fail('no-tab');
  if (info.active || info.discarded) return fail('not-allowed');
  const mb = estimateMb(info);
  try {
    await browser.tabs.discard(tabId);
  } catch {
    return fail('browser-error');
  }
  await finish([rowFor('coffin', tab, mb)], { coffined: 1 }, now);
  return { ok: true, changed: true, mb };
}

/** Crypt: save the tab, then close it. The tab stays open if the save fails. */
export async function crypt(tabId: number, now: number = Date.now()): Promise<ActionResult> {
  const tab = await getTab(tabId);
  const info = tab ? toTabInfo(tab) : null;
  if (!tab || !info) return fail('no-tab');
  const site = siteOf(tab.url);
  if (site === null || !tab.url) return fail('no-site');
  const url = tab.url;
  const mb = estimateMb(info);

  try {
    await transact(async () => {
      const items = await store.getCrypt();
      if (items.some((item) => item.url === url)) return;
      await store.setCrypt([
        ...items,
        { id: crypto.randomUUID(), url, title: tab.title ?? url, savedAt: now },
      ]);
    });
  } catch {
    return fail('save-failed');
  }

  try {
    await browser.tabs.remove(tabId);
  } catch {
    return fail('browser-error');
  }
  await finish([rowFor('crypt', tab, mb)], { crypted: 1 }, now);
  return { ok: true, changed: true, mb };
}

/** Garlic: protect the whole site. Repeating it changes nothing and logs nothing. */
export async function garlic(tabId: number, now: number = Date.now()): Promise<ActionResult> {
  const tab = await getTab(tabId);
  if (!tab || toTabInfo(tab) === null) return fail('no-tab');
  const site = siteOf(tab.url);
  if (site === null) return fail('no-site');

  let added: boolean;
  try {
    added = await transact(async () => {
      const sites = await store.getGarlic();
      if (sites.includes(site)) return false;
      await store.setGarlic([...sites, site]);
      return true;
    });
  } catch {
    return fail('browser-error');
  }
  if (!added) return { ok: true, changed: false, mb: 0 };
  await finish([rowFor('garlic', tab, 0)], {}, now);
  return { ok: true, changed: true, mb: 0 };
}

/** Un-garlic: remove protection from a site (hostname). */
export async function ungarlic(site: string, now: number = Date.now()): Promise<ActionResult> {
  let removed: boolean;
  try {
    removed = await transact(async () => {
      const sites = await store.getGarlic();
      if (!sites.includes(site)) return false;
      await store.setGarlic(sites.filter((s) => s !== site));
      return true;
    });
  } catch {
    return fail('browser-error');
  }
  if (!removed) return fail('not-found');
  await finish([{ action: 'garlic', site, mb: 0 }], {}, now);
  return { ok: true, changed: true, mb: 0 };
}

/** Resurrect: reopen a saved tab (background unless `activate`), then remove it from the crypt. */
export async function resurrect(
  itemId: string,
  now: number = Date.now(),
  options: { activate?: boolean } = {},
): Promise<ActionResult> {
  const item = (await store.getCrypt()).find((i) => i.id === itemId);
  if (!item) return fail('not-found');

  try {
    await browser.tabs.create({ url: item.url, active: options.activate === true });
  } catch {
    return fail('browser-error');
  }

  try {
    await transact(async () => {
      const items = await store.getCrypt();
      await store.setCrypt(items.filter((i) => i.id !== itemId));
    });
  } catch {
    // The tab is open and the item stays saved: a duplicate, not a loss.
  }
  await finish([{ action: 'resurrect', site: siteOf(item.url), title: item.title, mb: 0 }], {}, now);
  return { ok: true, changed: true, mb: 0 };
}

/**
 * Dawn: close every starving tab, saving each to the crypt first.
 * Never closes active, pinned, audible, discarded or garlic tabs, or tabs
 * without an http(s) URL. Each tab is checked again right before it closes.
 */
export async function dawn(now: number = Date.now()): Promise<DawnResult> {
  let tabs: Browser.tabs.Tab[];
  let garlicSites: string[];
  try {
    [tabs, garlicSites] = await Promise.all([browser.tabs.query({}), store.getGarlic()]);
  } catch {
    return { ok: false, reason: 'browser-error' };
  }

  const known = tabs.flatMap((tab) => {
    const info = toTabInfo(tab);
    return info ? [{ tab, info }] : [];
  });
  const targets = dawnTargets(
    known.map((k) => k.info),
    garlicSites,
    now,
  ).map((info) => known.find((k) => k.info === info)!);

  if (targets.length === 0) return { ok: true, closed: 0, mb: 0 };

  // 1. Save every target. Nothing is closed unless this succeeds.
  const addedItemIds = new Map<number, string>(); // tab id -> crypt item added by this run
  try {
    await transact(async () => {
      const items = await store.getCrypt();
      const next = [...items];
      for (const { tab, info } of targets) {
        const url = tab.url ?? '';
        if (next.some((item) => item.url === url)) continue;
        const id = crypto.randomUUID();
        next.push({ id, url, title: tab.title ?? url, savedAt: now });
        addedItemIds.set(info.id, id);
      }
      if (next.length !== items.length) await store.setCrypt(next);
    });
  } catch {
    return { ok: false, reason: 'save-failed' };
  }

  // 2. Check each tab again, then close it.
  const outcomes = await Promise.allSettled(
    targets.map(async ({ tab, info }) => {
      const fresh = await getTab(info.id);
      const freshInfo = fresh ? toTabInfo(fresh) : null;
      if (!freshInfo || !isDawnTarget(freshInfo, garlicSites, now)) return false;
      await browser.tabs.remove(info.id);
      return true;
    }),
  );
  const closed = targets.filter((_, i) => {
    const outcome = outcomes[i];
    return outcome?.status === 'fulfilled' && outcome.value;
  });
  const closedUrls = new Set(closed.map(({ tab }) => tab.url));

  // 3. Tabs that stayed open do not keep a crypt copy made by this run,
  //    unless a closed tab with the same URL still needs it.
  const stale = targets
    .filter((t) => !closed.includes(t) && !closedUrls.has(t.tab.url))
    .map((t) => addedItemIds.get(t.info.id))
    .filter((id): id is string => id !== undefined);
  if (stale.length > 0) {
    try {
      await transact(async () => {
        const items = await store.getCrypt();
        await store.setCrypt(items.filter((item) => !stale.includes(item.id)));
      });
    } catch {
      // A leftover copy of an open tab is harmless.
    }
  }

  // 4. Record what was closed.
  const mb = closed.reduce((sum, { info }) => sum + estimateMb(info), 0);
  if (closed.length > 0) {
    await finish(
      closed.map(({ tab, info }) => rowFor('dawn', tab, estimateMb(info))),
      { dawns: 1, crypted: closed.length },
      now,
    );
  } else {
    await refreshBadgeQuietly();
  }
  return { ok: true, closed: closed.length, mb };
}

// ---------- Tabpire's own pages ----------
interface OpenOptions {
  /** Open in the current tab instead of a new one. */
  sameTab?: boolean;
}
async function openOwnPage(path: string, sameTab: boolean): Promise<void> {
  const url = browser.runtime.getURL(path as never);
  if (sameTab) await browser.tabs.update({ url });
  else await browser.tabs.create({ url });
}
/** Opens The Crypt (the new tab page). */
export function openCrypt({ sameTab = false }: OpenOptions = {}): Promise<void> {
  return openOwnPage('/newtab.html', sameTab);
}
/** Opens the Blood Bank page (totals and the action log). */
export function openBloodBank({ sameTab = false }: OpenOptions = {}): Promise<void> {
  return openOwnPage('/bloodbank.html', sameTab);
}
