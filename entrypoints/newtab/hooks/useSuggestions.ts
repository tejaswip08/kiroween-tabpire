import { useEffect, useMemo, useState } from 'react';
import { fetchGoogleSuggestions } from '../../../lib/google';
import type { CryptEntry, Haunt } from '../../../lib/store';
import { localSuggestions, withWeb, type Suggestion } from '../../../lib/suggest';
import type { RawTab } from '../../../lib/view';

export const WEB_DEBOUNCE_MS = 200;
export const WEB_MIN_CHARS = 2;

export interface SuggestionSources {
  tabs: readonly RawTab[];
  haunts: readonly Haunt[];
  crypt: readonly CryptEntry[];
}

/**
 * Local suggestions appear on the same keystroke. Web suggestions are asked for
 * after a short pause, from 2 characters, and only the typed text is sent.
 * Any failure leaves the web list empty.
 */
export function useSuggestions(query: string, sources: SuggestionSources): Suggestion[] {
  const text = query.trim();
  const local = useMemo(
    () => localSuggestions(query, sources),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, sources.tabs, sources.haunts, sources.crypt],
  );
  const [web, setWeb] = useState<{ text: string; items: string[] } | null>(null);

  useEffect(() => {
    if (text.length < WEB_MIN_CHARS) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetchGoogleSuggestions(text, controller.signal).then((items) => {
        if (!controller.signal.aborted) setWeb({ text, items });
      });
    }, WEB_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  // Show web results only for the text they were asked for.
  const items = web && web.text === text && text.length >= WEB_MIN_CHARS ? web.items : [];
  return useMemo(() => withWeb(local, items, query), [local, items, query]);
}
