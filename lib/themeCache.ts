// The Sky_Cache: one Theme_Id in localStorage so a new tab paints the right sky at once.
// The only module that may use localStorage. Every call is inside try/catch. No tab data.
import { DEFAULT_THEME, isEnabledThemeId, type ThemeId } from './themes';

export const SKY_CACHE_KEY = 'tabpire:sky-theme';

/** The cached Theme_Id, or null when missing, unknown or unreadable. */
export function readCachedTheme(): ThemeId | null {
  try {
    const v = localStorage.getItem(SKY_CACHE_KEY);
    return isEnabledThemeId(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeCachedTheme(id: ThemeId): void {
  try {
    localStorage.setItem(SKY_CACHE_KEY, id);
  } catch {
    /* private mode, blocked or full: the cache is optional */
  }
}

export function clearCachedTheme(): void {
  try {
    localStorage.removeItem(SKY_CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Sets data-theme on the root to the cached id (or the default) and returns it. */
export function applyCachedTheme(root?: HTMLElement): ThemeId {
  const id = readCachedTheme() ?? DEFAULT_THEME;
  try {
    const el = root ?? document.documentElement;
    el.dataset.theme = id;
  } catch {
    /* no document */
  }
  return id;
}
