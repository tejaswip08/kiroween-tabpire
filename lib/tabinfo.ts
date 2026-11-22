import type { Browser } from 'wxt/browser';
import type { TabInfo } from './hunger';

/** Maps a browser tab to the plain shape the rules use. Tabs without an id are skipped. */
export function toTabInfo(tab: Browser.tabs.Tab): TabInfo | null {
  if (tab.id === undefined) return null;
  return {
    id: tab.id,
    url: tab.url,
    active: tab.active === true,
    audible: tab.audible === true,
    discarded: tab.discarded === true,
    pinned: tab.pinned === true,
    lastAccessed: tab.lastAccessed,
  };
}
