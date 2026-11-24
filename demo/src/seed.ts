// Sample data for the demo. Every dated value is an offset from the `now` that
// the caller passes in. This module never reads the clock.
import { browser, fake } from '../../lib/fakeBrowser';
import { fnv1a32 } from '../../lib/hunger';
import { KEYS } from '../../lib/store';
import { clearCachedTheme } from '../../lib/themeCache';
import type { CryptEntry, Haunt, LogEntry, Stats } from '../../lib/store';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** A small coloured square with the first letter, as a data URI. Makes no request. */
export function letterIcon(site: string): string {
  const letter = (site.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase();
  const hue = fnv1a32(site) % 360;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    `<rect width="32" height="32" rx="7" fill="hsl(${hue} 55% 38%)"/>` +
    '<text x="16" y="22" font-family="sans-serif" font-size="18" font-weight="700" ' +
    `text-anchor="middle" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface Row {
  site: string;
  url: string;
  title: string;
  /** How long ago the tab was last used. Hours or days, at least 2 hours from the one-day line. */
  idleMs: number;
  audible?: boolean;
  pinned?: boolean;
  discarded?: boolean;
}

/** Garlic sites. Their tabs below are protected. */
const GARLIC = ['notion.so', 'slack.com'];

const AWAKE: Row[] = [
  { site: 'github.com', url: 'https://github.com/tabpire/tabpire/pulls', title: 'Pull requests · tabpire/tabpire', idleMs: 1 * MIN },
  { site: 'figma.com', url: 'https://www.figma.com/file/Hk29xP/Crypt-redesign', title: 'Crypt redesign – Figma', idleMs: 12 * MIN },
  { site: 'docs.google.com', url: 'https://docs.google.com/document/d/1a2b3c/edit', title: 'Launch notes – Google Docs', idleMs: 40 * MIN },
  { site: 'claude.ai', url: 'https://claude.ai/chat/7f3e', title: 'Claude', idleMs: 1 * HOUR },
  { site: 'chatgpt.com', url: 'https://chatgpt.com/c/5d21', title: 'ChatGPT', idleMs: 3 * HOUR },
  { site: 'linkedin.com', url: 'https://www.linkedin.com/feed/', title: 'Feed | LinkedIn', idleMs: 5 * HOUR },
];

const AUDIBLE: Row = {
  site: 'youtube.com',
  url: 'https://www.youtube.com/watch?v=lofi-night-beats',
  title: 'Lofi night beats to study to – YouTube',
  idleMs: 2 * MIN,
  audible: true,
};

const STARVING: Row[] = [
  { site: 'x.com', url: 'https://x.com/home', title: 'Home / X', idleMs: 29 * HOUR },
  { site: 'twitter.com', url: 'https://twitter.com/explore', title: 'Explore / Twitter', idleMs: 36 * HOUR },
  { site: 'discord.com', url: 'https://discord.com/channels/@me', title: 'Discord | Friends', idleMs: 2 * DAY },
  { site: 'meet.google.com', url: 'https://meet.google.com/abc-defg-hij', title: 'Meet – Weekly sync', idleMs: 60 * HOUR },
  { site: 'github.com', url: 'https://github.com/vitejs/vite/issues/1234', title: 'Issue #1234 · vitejs/vite', idleMs: 3 * DAY },
  { site: 'figma.com', url: 'https://www.figma.com/file/Qr71zD/Icons', title: 'Icons – Figma', idleMs: 84 * HOUR },
  { site: 'docs.google.com', url: 'https://docs.google.com/spreadsheets/d/9z8y/edit', title: 'Budget – Google Sheets', idleMs: 4 * DAY },
  { site: 'chatgpt.com', url: 'https://chatgpt.com/c/91ab', title: 'ChatGPT – recipe ideas', idleMs: 110 * HOUR },
];

const PINNED_STARVING: Row = {
  site: 'mail.google.com',
  url: 'https://mail.google.com/mail/u/0/#inbox',
  title: 'Inbox – Gmail',
  idleMs: 2 * DAY,
  pinned: true,
};

const GARLIC_TABS: Row[] = [
  { site: 'notion.so', url: 'https://www.notion.so/Roadmap-4c1d', title: 'Roadmap – Notion', idleMs: 36 * HOUR },
  { site: 'slack.com', url: 'https://slack.com/client/T01/C02', title: 'Slack | #general', idleMs: 3 * DAY },
];

const DISCARDED: Row = {
  site: 'netflix.com',
  url: 'https://www.netflix.com/browse',
  title: 'Netflix',
  idleMs: 6 * DAY,
  discarded: true,
};

const HAUNTS: Haunt[] = [
  { url: 'https://github.com/', title: 'GitHub' },
  { url: 'https://claude.ai/', title: 'Claude' },
  { url: 'https://www.youtube.com/', title: 'YouTube' },
  { url: 'https://docs.google.com/', title: 'Google Docs' },
];

const STATS: Stats = { staked: 12, coffined: 5, crypted: 9, dawns: 2, mbFreed: 3400 };

/** Crypt entries: how long ago each was saved. */
const CRYPT: { id: string; url: string; title: string; agoMs: number }[] = [
  { id: 'demo-crypt-1', url: 'https://www.reddit.com/r/programming/', title: 'programming', agoMs: 1 * DAY },
  { id: 'demo-crypt-2', url: 'https://news.ycombinator.com/', title: 'Hacker News', agoMs: 2 * DAY },
  { id: 'demo-crypt-3', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Storage', title: 'Storage – Web APIs | MDN', agoMs: 3 * DAY },
];

/** Log entries, oldest first. `agoMs` is how long before now. */
const LOG: { agoMs: number; action: LogEntry['action']; site: string | null; title?: string }[] = [
  { agoMs: 70 * HOUR, action: 'stake', site: 'reddit.com', title: 'r/all' },
  { agoMs: 60 * HOUR, action: 'crypt', site: 'news.ycombinator.com', title: 'Hacker News' },
  { agoMs: 50 * HOUR, action: 'coffin', site: 'netflix.com', title: 'Netflix' },
  { agoMs: 40 * HOUR, action: 'garlic', site: 'notion.so' },
  { agoMs: 30 * HOUR, action: 'dawn', site: null },
  { agoMs: 20 * HOUR, action: 'resurrect', site: 'developer.mozilla.org', title: 'Storage – Web APIs | MDN' },
  { agoMs: 8 * HOUR, action: 'stake', site: 'twitter.com', title: 'Explore / Twitter' },
  { agoMs: 3 * HOUR, action: 'crypt', site: 'reddit.com', title: 'programming' },
];

/**
 * Fills the fake with the sample tabs and stored data, with every time taken
 * from `now`. The fake's storage.set applies its writes before it returns, so
 * the data is in place when this function returns.
 */
export function seedDemo(now: number): void {
  const add = (row: Row) =>
    fake.addTab({
      url: row.url,
      title: row.title,
      favIconUrl: letterIcon(row.site),
      lastAccessed: now - row.idleMs,
      audible: row.audible === true,
      pinned: row.pinned === true,
      discarded: row.discarded === true,
      active: false,
    });

  const crypt = fake.addTab({
    url: browser.runtime.getURL('newtab.html'),
    title: 'The Crypt',
    active: true,
    lastAccessed: now,
  });
  for (const row of [...AWAKE, AUDIBLE, ...STARVING, PINNED_STARVING, ...GARLIC_TABS, DISCARDED]) add(row);

  const cryptEntries: CryptEntry[] = CRYPT.map((c) => ({ id: c.id, url: c.url, title: c.title, savedAt: now - c.agoMs }));
  const log: LogEntry[] = LOG.map(({ agoMs, ...rest }) => ({ at: now - agoMs, ...rest }));

  void browser.storage.local.set({
    [KEYS.garlic]: [...GARLIC],
    [KEYS.haunts]: HAUNTS.map((h) => ({ ...h })),
    [KEYS.crypt]: cryptEntries,
    [KEYS.stats]: { ...STATS },
    [KEYS.log]: log,
  });

  fake.currentTabId = crypt.id;
  fake.autoEvents = true;
}

/** Clears the fake, waits one tick so late writes from the old page land first, then seeds again. */
export async function resetDemo(now: number): Promise<void> {
  fake.clearData(); // also removes the saved theme, so the default crypt applies
  clearCachedTheme();
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = 'crypt';
  await Promise.resolve();
  seedDemo(now);
}
