import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { store, subscribe, type CryptItem, type PinnedPage, type Stats } from '../../../lib/store';
import { buildCards, toRawTab, type Card, type RawTab } from '../../../lib/view';

export const REFRESH_DEBOUNCE_MS = 150;
export const TICK_MS = 60_000;

interface Stored {
  garlic: string[];
  stats: Stats;
  crypt: CryptItem[];
  pinned: PinnedPage[];
}

interface TabsView {
  cards: Card[];
  rawTabs: RawTab[];
  now: number;
}

export interface CryptData extends Stored, TabsView {
  status: 'loading' | 'ready' | 'error';
  /** Reload everything now. */
  reload: () => void;
}

const EMPTY_STORED: Stored = {
  garlic: [],
  stats: { staked: 0, coffined: 0, crypted: 0, dawns: 0, mbFreed: 0 },
  crypt: [],
  pinned: [],
};
const EMPTY_TABS: TabsView = { cards: [], rawTabs: [], now: 0 };

async function loadStored(): Promise<Stored> {
  const [garlic, stats, crypt, pinned] = await Promise.all([
    store.getGarlic(),
    store.getStats(),
    store.getCrypt(),
    store.getPinned(),
  ]);
  return { garlic, stats, crypt, pinned };
}

async function loadTabs(): Promise<{ rawTabs: RawTab[]; currentId: number | undefined }> {
  const [tabs, current] = await Promise.all([browser.tabs.query({}), browser.tabs.getCurrent()]);
  const rawTabs = tabs.flatMap((t) => {
    const raw = toRawTab(t);
    return raw ? [raw] : [];
  });
  return { rawTabs, currentId: current?.id };
}

/**
 * Live view of the open tabs and the stored data.
 * Refreshes when tabs change, when other Tabpire pages write data, once a minute,
 * and when the page becomes visible. Bursts of events cause one refresh.
 */
export function useCryptData(): CryptData {
  const [stored, setStored] = useState<Stored | null>(null);
  const [tabsView, setTabsView] = useState<TabsView | null>(null);
  const [failed, setFailed] = useState(false);

  const started = useRef(0); // sequence of the newest refresh started
  const applied = useRef(0); // sequence of the newest result shown
  const hasData = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    const mine = ++started.current;
    // Stored data and tabs load separately, so the pinned pages and search
    // can still work when the tab list cannot be read.
    const [storedResult, tabsResult] = await Promise.allSettled([loadStored(), loadTabs()]);
    if (mine < applied.current) return; // an older result must not replace a newer one
    applied.current = mine;

    if (storedResult.status === 'fulfilled') setStored(storedResult.value);

    if (storedResult.status === 'fulfilled' && tabsResult.status === 'fulfilled') {
      const now = Date.now();
      const { rawTabs, currentId } = tabsResult.value;
      const cards = buildCards(rawTabs, currentId, browser.runtime.getURL(''), storedResult.value.garlic, now);
      hasData.current = true;
      setTabsView({ cards, rawTabs, now });
      setFailed(false);
    } else if (!hasData.current) {
      // Keep the last good data. Only a failed first load is shown as an error.
      setFailed(true);
    }
  }, []);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const { tabs } = browser;
    const tabEvents = [
      tabs.onCreated,
      tabs.onRemoved,
      tabs.onUpdated,
      tabs.onActivated,
      tabs.onAttached,
      tabs.onDetached,
      tabs.onReplaced,
    ];
    for (const e of tabEvents) e.addListener(schedule);
    const unsubscribe = subscribe(schedule);
    const interval = setInterval(schedule, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      for (const e of tabEvents) e.removeListener(schedule);
      unsubscribe();
      clearInterval(interval);
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, schedule]);

  const reload = useCallback(() => {
    setFailed(false);
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      ...(stored ?? EMPTY_STORED),
      ...(tabsView ?? EMPTY_TABS),
      status: tabsView && stored ? 'ready' : failed ? 'error' : 'loading',
      reload,
    }),
    [stored, tabsView, failed, reload],
  );
}
