import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store, onStoreChange, KEYS } from '../../../lib/store';
import { DEFAULT_THEME, isEnabledThemeId, type ThemeId } from '../../../lib/themes';
import { readCachedTheme, writeCachedTheme } from '../../../lib/themeCache';

export interface ThemeState {
  themeId: ThemeId;
  /** Applies a theme at once and saves it. A value that is not a ThemeId is ignored. */
  setTheme: (id: ThemeId) => void;
  /** Counts failed reads and writes. It only goes up, so a change means "show the notice". */
  saveFailed: number;
}

/**
 * The Active_Theme of a page. Starts from the Sky_Cache (the value bootTheme applied),
 * reads the saved choice once, follows `tabpire:theme` changes from other pages,
 * and keeps `data-theme` on the root element and the Sky_Cache equal to the state.
 */
export function useTheme(): ThemeState {
  const [themeId, setThemeId] = useState<ThemeId>(() => readCachedTheme() ?? DEFAULT_THEME);
  const [saveFailed, setSaveFailed] = useState(0);
  const current = useRef(themeId); // the theme shown, for reverting a failed write
  const choice = useRef(0); // sequence of the newest choice made in this page
  const mounted = useRef(false);

  // Same commit as the state change, so tokens change together with the click.
  useLayoutEffect(() => {
    current.current = themeId;
    document.documentElement.dataset.theme = themeId;
    writeCachedTheme(themeId);
  }, [themeId]);

  const fail = useCallback(() => setSaveFailed((n) => n + 1), []);

  useEffect(() => {
    mounted.current = true;
    const startedAt = choice.current;
    store.getTheme().then(
      (id) => {
        // A choice made while this read was pending is newer than the read.
        if (mounted.current && choice.current === startedAt) setThemeId(id);
      },
      () => {
        if (mounted.current) fail();
      },
    );
    const unsubscribe = onStoreChange((keys) => {
      if (!keys.includes(KEYS.theme)) return;
      store.getTheme().then(
        (id) => {
          if (mounted.current) setThemeId(id);
        },
        () => {
          if (mounted.current) fail();
        },
      );
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [fail]);

  const setTheme = useCallback(
    (id: ThemeId) => {
      if (!isEnabledThemeId(id)) return;
      const mine = ++choice.current;
      const previous = current.current;
      current.current = id;
      setThemeId(id);
      store.setTheme(id).catch(() => {
        if (!mounted.current) return;
        // A newer choice stays: only the newest write may undo itself.
        if (choice.current === mine) setThemeId(previous);
        fail();
      });
    },
    [fail],
  );

  return { themeId, setTheme, saveFailed };
}
