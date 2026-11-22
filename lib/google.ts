// The only network call in the page code: search suggestions.
// Only the text typed in the search box is sent. Nothing about tabs.
import { parseGoogleResponse } from './suggest';

export const SUGGEST_ORIGIN = 'https://suggestqueries.google.com';
export const SUGGEST_TIMEOUT_MS = 1500;

/** Returns [] on any failure: offline, slow, blocked, bad response or aborted. */
export async function fetchGoogleSuggestions(query: string, signal: AbortSignal): Promise<string[]> {
  if (signal.aborted) return [];
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(stop, SUGGEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${SUGGEST_ORIGIN}/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
      {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      },
    );
    if (!response.ok) return [];
    return parseGoogleResponse(await response.json());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
  }
}
