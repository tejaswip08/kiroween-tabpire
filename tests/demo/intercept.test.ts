import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import { browser, fake } from '../../lib/fakeBrowser';
import { installInterceptors } from '../../demo/src/intercept';
import type { DemoRoute } from '../../demo/src/intercept';
import { subscribe } from '../../demo/src/notice';
import type { DemoNotice } from '../../demo/src/notice';

const RUNS = 100;

let notices: DemoNotice[];
let routes: DemoRoute[];
let unsubscribe: () => void;

beforeEach(() => {
  fake.reset();
  notices = [];
  routes = [];
  unsubscribe = subscribe((n) => notices.push(n));
  installInterceptors((r) => routes.push(r));
  fake.addTab({ id: 1, url: 'https://github.com/a', title: 'A', active: true });
  fake.addTab({ id: 2, url: 'https://figma.com/b', title: 'B' });
  fake.currentTabId = 1;
});

afterEach(() => unsubscribe());

const urls = () => [...fake.tabs.values()].map((t) => [t.id, t.url]);

describe('interceptors', () => {
  it('Feature: web-demo, Property 5: intercepted navigation changes nothing', async () => {
    const own = fc.constantFrom('newtab.html', 'bloodbank.html', 'newtab.html#x', 'bloodbank.html?a=1');
    const url = fc.oneof(
      fc.webUrl(),
      fc.string(),
      fc.constant('javascript:alert(1)'),
      fc.constant('mailto:a@b.c'),
      fc.constant('chrome://settings'),
      fc.constant('chrome-extension://fake-id/other.html'),
      own.map((p) => fake.extensionBase + p),
    );
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(1, 2), url, async (id, u) => {
        notices.length = 0;
        routes.length = 0;
        const before = urls();
        await browser.tabs.update(id, { url: u });
        expect(urls()).toEqual(before);
        expect(fake.tabs.size).toBe(2);
        const isOwn = u.startsWith(fake.extensionBase + 'newtab.html') || u.startsWith(fake.extensionBase + 'bloodbank.html');
        if (isOwn) {
          expect(notices).toHaveLength(0);
          expect(routes).toEqual([u.startsWith(fake.extensionBase + 'newtab.html') ? 'crypt' : 'bloodbank']);
        } else {
          expect(notices).toHaveLength(1);
          expect(routes).toHaveLength(0);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('own page addresses change only the route', async () => {
    await browser.tabs.update(1, { url: fake.extensionBase + 'bloodbank.html' });
    expect(routes).toEqual(['bloodbank']);
    expect(fake.tabs.get(1)!.url).toBe('https://github.com/a');
    expect(notices).toHaveLength(0);
  });

  it('update with active: true raises a notice and does not activate', async () => {
    await browser.tabs.update(2, { active: true });
    expect(fake.tabs.get(2)!.active).toBe(false);
    expect(notices.map((n) => n.text)).toEqual(['In the extension this switches to B.']);
  });

  it('tabs.create with a web URL is not intercepted', async () => {
    const tab = await browser.tabs.create({ url: 'https://example.org/x' });
    expect(tab?.url).toBe('https://example.org/x');
    expect(fake.tabs.size).toBe(3);
    expect(notices).toHaveLength(0);
  });

  it('tabs.create with an unknown scheme raises a notice and creates nothing', async () => {
    await browser.tabs.create({ url: 'chrome://settings' });
    expect(fake.tabs.size).toBe(2);
    expect(notices).toHaveLength(1);
  });

  it('search raises a notice and records the search', async () => {
    await browser.search.query({ text: 'vampire bats' });
    expect(fake.searches.map((s) => s.text)).toEqual(['vampire bats']);
    expect(notices.map((n) => n.text)).toEqual([
      'Searched for "vampire bats" (the extension uses your default search engine).',
    ]);
  });

  it('a notice is plain memory: no timers or storage involved', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    void browser.tabs.update(1, { url: 'https://x.com/' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
