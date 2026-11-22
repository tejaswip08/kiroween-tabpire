import { browser } from 'wxt/browser';
import { badgeText, countStarving } from './hunger';
import { store } from './store';
import { toTabInfo } from './tabinfo';

const BADGE_COLOR = '#8f1020';

/** Shows the number of starving tabs on the toolbar badge. */
export async function refreshBadge(now: number = Date.now()): Promise<void> {
  const [tabs, garlic] = await Promise.all([browser.tabs.query({}), store.getGarlic()]);
  const infos = tabs.flatMap((t) => {
    const info = toTabInfo(t);
    return info ? [info] : [];
  });
  const count = countStarving(infos, garlic, now);
  await browser.action.setBadgeText({ text: badgeText(count) });
  await browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
}

export const BADGE_ALARM = 'tabpire-badge';

async function refreshQuietly(): Promise<void> {
  try {
    await refreshBadge();
  } catch {
    // The next alarm retries.
  }
}

/**
 * Registers every listener synchronously, as a service worker requires, then
 * refreshes once. Re-creating the alarm replaces the old one, so there is
 * never a duplicate.
 */
export function setupBadgeUpdates(): void {
  browser.alarms.create(BADGE_ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BADGE_ALARM) void refreshQuietly();
  });
  browser.runtime.onInstalled.addListener(() => void refreshQuietly());
  browser.runtime.onStartup.addListener(() => void refreshQuietly());
  void refreshQuietly();
}
