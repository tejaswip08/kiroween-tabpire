// Pinned pages: the row under the search box.
import { siteOf } from './hunger';
import { store, transact, type PinnedPage } from './store';

export const MAX_PINNED = 12;

export type AddressCheck =
  | { ok: true; url: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'not-web' };

const HAS_WEB_STYLE_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const NON_WEB_SCHEME =
  /^(javascript|data|mailto|tel|about|chrome|edge|file|blob|view-source|chrome-extension|moz-extension|ftp):/i;

/** Pure. Accepts "example.com" or a full http(s) address. Saves `URL.href`. */
export function checkAddress(input: string): AddressCheck {
  const text = input.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (NON_WEB_SCHEME.test(text)) return { ok: false, reason: 'not-web' };

  const withScheme = HAS_WEB_STYLE_SCHEME.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'not-web' };
  const host = url.hostname;
  if (host === '' || !(host.includes('.') || host === 'localhost')) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, url: url.href };
}

/** First letter or digit, upper case, for the letter badge. */
export function pinnedLetter(page: { title: string; url: string }): string {
  const source = page.title.trim() || siteOf(page.url) || '?';
  const match = source.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : '?';
}

export type PinResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'invalid' | 'not-web' | 'full' | 'duplicate' };

export async function pinPage(input: string, name?: string): Promise<PinResult> {
  const check = checkAddress(input);
  if (!check.ok) return check;
  const title = name?.trim() || siteOf(check.url) || check.url;

  return transact(async (): Promise<PinResult> => {
    const pages = await store.getPinned();
    if (pages.length >= MAX_PINNED) return { ok: false, reason: 'full' };
    if (pages.some((p) => p.url === check.url)) return { ok: false, reason: 'duplicate' };
    const page: PinnedPage = { url: check.url, title };
    await store.setPinned([...pages, page]);
    return { ok: true };
  });
}

export async function unpinPage(url: string): Promise<void> {
  await transact(async () => {
    const pages = await store.getPinned();
    await store.setPinned(pages.filter((p) => p.url !== url));
  });
}

/** Plain-word text for a failed attempt to add a page. */
export function pinProblemText(reason: Exclude<PinResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'empty':
      return 'Type a web address, like example.com.';
    case 'invalid':
      return 'That does not look like a web address. Try something like example.com.';
    case 'not-web':
      return 'Only web addresses that start with http or https can be added.';
    case 'full':
      return `You can add up to ${MAX_PINNED} pages. Remove one first.`;
    case 'duplicate':
      return 'That page is already in the list.';
  }
}
