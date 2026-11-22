// Browser glue for the search box and suggestions.
import { browser } from 'wxt/browser';

/** Firefox and Chrome expose the default search engine differently. */
interface SearchApi {
  query?: (info: { text: string; disposition?: string }) => Promise<void>;
  search?: (info: { query: string; tabId?: number }) => Promise<void>;
}

/** Searches with the browser's default search engine, in this tab. */
export async function searchWithDefaultEngine(text: string): Promise<void> {
  const query = text.trim();
  if (query === '') return;
  const api = browser.search as unknown as SearchApi;
  if (typeof api.search === 'function') {
    const current = await browser.tabs.getCurrent();
    await api.search({ query, tabId: current?.id });
    return;
  }
  await api.query?.({ text: query, disposition: 'CURRENT_TAB' });
}

/** Opens an address in this tab. */
export async function openInThisTab(url: string): Promise<void> {
  const current = await browser.tabs.getCurrent();
  await browser.tabs.update(current?.id as number, { url });
}

/** Switches to a tab and brings its window forward. */
export async function showTab(tab: { id: number; windowId: number }): Promise<void> {
  await browser.tabs.update(tab.id, { active: true });
  if (tab.windowId >= 0) await browser.windows.update(tab.windowId, { focused: true });
}
