import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('wxt/browser', async () => {
  const m = await import('./helpers/fakeBrowser');
  return { browser: m.browser };
});

import { fake } from './helpers/fakeBrowser';
import { store } from '../lib/store';
import {
  MAX_PINNED,
  checkAddress,
  pinPage,
  pinProblemText,
  pinnedLetter,
  unpinPage,
} from '../lib/pinned';

beforeEach(() => fake.reset());

describe('checkAddress', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['  example.com/path?q=1  ', 'https://example.com/path?q=1'],
    ['http://example.com', 'http://example.com/'],
    ['https://Sub.Example.com/A', 'https://sub.example.com/A'],
    ['localhost:3000', 'https://localhost:3000/'],
    ['example.com:8080/x', 'https://example.com:8080/x'],
  ])('accepts %s', (input, url) => {
    expect(checkAddress(input)).toEqual({ ok: true, url });
  });

  it('rejects blanks', () => {
    expect(checkAddress('')).toEqual({ ok: false, reason: 'empty' });
    expect(checkAddress('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it.each(['javascript:alert(1)', 'chrome://extensions', 'about:blank', 'file:///etc/passwd', 'ftp://example.com', 'data:text/html,hi', 'mailto:a@b.com'])(
    'rejects non-web address %s',
    (input) => {
      expect(checkAddress(input)).toEqual({ ok: false, reason: 'not-web' });
    },
  );

  it.each(['not an address', 'hello', 'a b.com', 'https://'])('rejects %s as invalid', (input) => {
    expect(checkAddress(input)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('never accepts anything but http and https', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const r = checkAddress(input);
        if (r.ok) expect(r.url.startsWith('http://') || r.url.startsWith('https://')).toBe(true);
      }),
      { numRuns: 500 },
    );
    fc.assert(
      fc.property(
        fc.constantFrom('javascript', 'data', 'file', 'chrome', 'about', 'ftp', 'blob'),
        fc.string(),
        (scheme, rest) => {
          expect(checkAddress(`${scheme}:${rest}`).ok).toBe(false);
        },
      ),
    );
  });
});

describe('pinnedLetter', () => {
  it('uses the first letter of the title, then the site', () => {
    expect(pinnedLetter({ title: 'github', url: 'https://x.com/' })).toBe('G');
    expect(pinnedLetter({ title: '  ', url: 'https://www.example.com/' })).toBe('E');
    expect(pinnedLetter({ title: '!!!', url: 'https://example.com/' })).toBe('?');
    expect(pinnedLetter({ title: '3 things', url: 'https://example.com/' })).toBe('3');
  });
});

describe('pinPage', () => {
  it('adds a page and defaults the name to the site', async () => {
    expect(await pinPage('www.example.com/docs')).toEqual({ ok: true });
    expect(await store.getPinned()).toEqual([{ url: 'https://www.example.com/docs', title: 'example.com' }]);
  });

  it('uses the given name', async () => {
    await pinPage('example.com', '  My page ');
    expect((await store.getPinned())[0]?.title).toBe('My page');
  });

  it('rejects a bad address without changing anything', async () => {
    expect(await pinPage('chrome://extensions')).toEqual({ ok: false, reason: 'not-web' });
    expect(await store.getPinned()).toEqual([]);
  });

  it('rejects a duplicate, even when typed differently', async () => {
    await pinPage('example.com');
    expect(await pinPage('https://example.com/')).toEqual({ ok: false, reason: 'duplicate' });
    expect(await store.getPinned()).toHaveLength(1);
  });

  it('stops at 12 pages', async () => {
    for (let i = 0; i < MAX_PINNED; i++) expect((await pinPage(`site${i}.com`)).ok).toBe(true);
    expect(await pinPage('one-more.com')).toEqual({ ok: false, reason: 'full' });
    expect(await store.getPinned()).toHaveLength(MAX_PINNED);
  });

  it('does not exceed 12 when many adds run at once', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => pinPage(`s${i}.com`)));
    expect(results.filter((r) => r.ok)).toHaveLength(MAX_PINNED);
    expect(await store.getPinned()).toHaveLength(MAX_PINNED);
  });
});

describe('unpinPage', () => {
  it('removes only the named page', async () => {
    await pinPage('a.com');
    await pinPage('b.com');
    await unpinPage('https://a.com/');
    expect((await store.getPinned()).map((p) => p.url)).toEqual(['https://b.com/']);
  });
});

describe('pinProblemText', () => {
  it('has plain text for every reason', () => {
    for (const r of ['empty', 'invalid', 'not-web', 'full', 'duplicate'] as const) {
      expect(pinProblemText(r).length).toBeGreaterThan(10);
    }
  });
});
