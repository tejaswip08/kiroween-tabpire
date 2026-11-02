import { browser } from 'wxt/browser';
import { stageOf } from '../lib/hunger';
import { load } from '../lib/store';
import { now, readTabs } from '../lib/tabs';

// Keeps the toolbar badge showing how many vampires are starving.
export default defineBackground(() => {
  async function refreshBadge() {
    const [tabs, s, t] = await Promise.all([readTabs(), load(), now()]);
    const garlic = new Set(s.garlic);
    const starving = tabs.filter((tab) => stageOf(tab, t, garlic) === 'starving').length;
    await browser.action.setBadgeText({ text: starving ? String(starving) : '' });
    await browser.action.setBadgeBackgroundColor({ color: '#A32D2D' });
  }

  browser.alarms.create('tick', { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener(refreshBadge);
  browser.tabs.onActivated.addListener(refreshBadge);
  browser.tabs.onRemoved.addListener(refreshBadge);
  browser.tabs.onCreated.addListener(refreshBadge);
  browser.storage.onChanged.addListener(refreshBadge);
  refreshBadge();
});
