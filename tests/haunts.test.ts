import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('wxt/browser', async () => {
  const m = await import('./helpers/fakeBrowser');
  return { browser: m.browser };
});

import { fake } from './helpers/fakeBrowser';
import { MAX_HAUNTS, store } from '../lib/store';
import {
  checkAddress,
  addHaunt,
  hauntProblemText,
  hauntLetter,
  removeHaunt,
} from '../lib/haunts';

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

describe('hauntLetter', () => {
  it('uses the first letter of the title, then the site', () => {
    expect(hauntLetter({ title: 'github', url: 'https://x.com/' })).toBe('G');
    expect(hauntLetter({ title: '  ', url: 'https://www.example.com/' })).toBe('E');
    expect(hauntLetter({ title: '!!!', url: 'https://example.com/' })).toBe('?');
    expect(hauntLetter({ title: '3 things', url: 'https://example.com/' })).toBe('3');
  });
});

describe('addHaunt', () => {
  it('adds a page and defaults the name to the site', async () => {
    expect(await addHaunt('www.example.com/docs')).toEqual({ ok: true });
    expect(await store.getHaunts()).toEqual([{ url: 'https://www.example.com/docs', title: 'example.com' }]);
  });

  it('uses the given name', async () => {
    await addHaunt('example.com', '  My page ');
    expect((await store.getHaunts())[0]?.title).toBe('My page');
  });

  it('rejects a bad address without changing anything', async () => {
    expect(await addHaunt('chrome://extensions')).toEqual({ ok: false, reason: 'not-web' });
    expect(await store.getHaunts()).toEqual([]);
  });

  it('rejects a duplicate, even when typed differently', async () => {
    await addHaunt('example.com');
    expect(await addHaunt('https://example.com/')).toEqual({ ok: false, reason: 'duplicate' });
    expect(await store.getHaunts()).toHaveLength(1);
  });

  it('stops at the most haunts (MAX_HAUNTS)', async () => {
    for (let i = 0; i < MAX_HAUNTS; i++) expect((await addHaunt(`site${i}.com`)).ok).toBe(true);
    expect(await addHaunt('one-more.com')).toEqual({ ok: false, reason: 'full' });
    expect(await store.getHaunts()).toHaveLength(MAX_HAUNTS);
  });

  it('does not exceed MAX_HAUNTS when many adds run at once', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => addHaunt(`s${i}.com`)));
    expect(results.filter((r) => r.ok)).toHaveLength(MAX_HAUNTS);
    expect(await store.getHaunts()).toHaveLength(MAX_HAUNTS);
  });
});

describe('removeHaunt', () => {
  it('removes only the named page', async () => {
    await addHaunt('a.com');
    await addHaunt('b.com');
    await removeHaunt('https://a.com/');
    expect((await store.getHaunts()).map((p) => p.url)).toEqual(['https://b.com/']);
  });
});

describe('hauntProblemText', () => {
  it('has plain text for every reason', () => {
    for (const r of ['empty', 'invalid', 'not-web', 'full', 'duplicate'] as const) {
      expect(hauntProblemText(r).length).toBeGreaterThan(10);
    }
  });
});

describe('haunt icon sources', () => {
  it('lists the tab icon, the Chrome cache, the site favicon, then DuckDuckGo, in that order', async () => {
    const { faviconSources } = await import('../entrypoints/newtab/Haunts');
    expect(
      faviconSources('https://www.example.com/a?b=1', { tabIcon: 'https://cdn.example.com/i.png', chromeBase: 'chrome-extension://abc/_favicon/' }),
    ).toEqual([
      'https://cdn.example.com/i.png',
      'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fwww.example.com%2Fa%3Fb%3D1&size=32',
      'https://www.example.com/favicon.ico',
      'https://icons.duckduckgo.com/ip3/www.example.com.ico',
    ]);
  });
  it('skips what is missing or unsafe and never repeats an address', async () => {
    const { faviconSources } = await import('../entrypoints/newtab/Haunts');
    expect(faviconSources('https://a.com/', { tabIcon: 'javascript:alert(1)', chromeBase: 'moz-extension://x/_favicon/' })).toEqual([
      'https://a.com/favicon.ico',
      'https://icons.duckduckgo.com/ip3/a.com.ico',
    ]);
    expect(faviconSources('https://a.com/', { tabIcon: 'https://a.com/favicon.ico' })[0]).toBe('https://a.com/favicon.ico');
    expect(faviconSources('https://a.com/', { tabIcon: 'https://a.com/favicon.ico' })).toHaveLength(2);
    expect(faviconSources('not a url')).toEqual([]);
  });
});
