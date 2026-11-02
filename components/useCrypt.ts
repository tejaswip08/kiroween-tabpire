import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { TabLike } from '../lib/hunger';
import { load, onStoreChange } from '../lib/store';
import { now, readTabs } from '../lib/tabs';

type Store = Awaited<ReturnType<typeof load>>;

/** Live view of open tabs + stored state, refreshed on tab and storage events. */
export function useCrypt() {
  const [tabs, setTabs] = useState<TabLike[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [time, setTime] = useState(Date.now());

  const refresh = useCallback(async () => {
    const [t, s, n] = await Promise.all([readTabs(), load(), now()]);
    setTabs(t);
    setStore(s);
    setTime(n);
  }, []);

  useEffect(() => {
    refresh();
    const events = [
      browser.tabs.onCreated,
      browser.tabs.onRemoved,
      browser.tabs.onUpdated,
      browser.tabs.onActivated,
    ] as { addListener(f: () => void): void; removeListener(f: () => void): void }[];
    const handler = () => refresh();
    events.forEach((e) => e.addListener(handler));
    const offStore = onStoreChange(handler);
    const timer = setInterval(handler, 30_000);
    return () => {
      events.forEach((e) => e.removeListener(handler));
      offStore();
      clearInterval(timer);
    };
  }, [refresh]);

  return { tabs, store, time, garlic: new Set(store?.garlic ?? []), refresh };
}
