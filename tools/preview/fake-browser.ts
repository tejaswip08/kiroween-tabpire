// In-memory stand-in for `wxt/browser` so the Crypt runs as a plain web page (demo + layout checks).
type Listener = (...args: unknown[]) => void;

function event() {
  const ls = new Set<Listener>();
  return {
    addListener: (f: Listener) => void ls.add(f),
    removeListener: (f: Listener) => void ls.delete(f),
    emit: (...a: unknown[]) => ls.forEach((f) => f(...a)),
  };
}

const H = 3600_000;
const now = Date.now();
const fav = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`;

const SAMPLE: [string, string, number, Partial<{ audible: boolean; active: boolean; discarded: boolean }>?][] = [
  ['https://www.youtube.com/watch?v=lofi', 'lofi beats to relax / study to', 0.2, { audible: true }],
  ['https://www.figma.com/file/crypt', 'Crypt redesign – Figma', 50],
  ['https://mail.google.com/mail/u/0', 'Inbox (1,204) – Gmail', 30],
  ['https://news.ycombinator.com', 'Hacker News', 0.05, { active: true }],
  ['https://en.wikipedia.org/wiki/Vampire', 'Vampire – Wikipedia', 3],
  ['https://www.reddit.com/r/halloween', 'r/halloween', 72],
  ['https://github.com/kiro', 'kiro · GitHub', 0.5],
  ['https://developer.mozilla.org/en-US/docs/Web/API/Tabs', 'Tabs API – MDN', 2],
  ['https://www.notion.so/roadmap', 'Q4 roadmap – Notion', 26],
  ['https://docs.google.com/document/d/1', 'Kiroween write-up – Google Docs', 0.8],
  ['https://slack.com/app', 'Slack | #kiroween', 5],
  ['https://www.netflix.com/title/dracula', 'Dracula | Netflix', 0, { discarded: true }],
];

let nextId = 1;
const tabs = SAMPLE.map(([url, title, idleH, extra]) => ({
  id: nextId++,
  url,
  title,
  favIconUrl: fav(new URL(url).hostname),
  lastAccessed: now - idleH * H,
  active: false,
  audible: false,
  discarded: false,
  pinned: false,
  ...extra,
}));

const store: Record<string, unknown> = { garlic: ['slack.com'] };
const tabEvents = { onCreated: event(), onRemoved: event(), onUpdated: event(), onActivated: event() };
const storageChanged = event();

export const browser = {
  runtime: { getURL: (p: string) => location.origin + p },
  tabs: {
    ...tabEvents,
    async query() {
      return tabs.map((t) => ({ ...t }));
    },
    async remove(ids: number | number[]) {
      for (const id of ([] as number[]).concat(ids)) {
        const i = tabs.findIndex((t) => t.id === id);
        if (i >= 0) tabs.splice(i, 1);
      }
      tabEvents.onRemoved.emit();
    },
    async discard(id: number) {
      const t = tabs.find((x) => x.id === id);
      if (t) t.discarded = true;
      tabEvents.onUpdated.emit();
    },
    async update(id: number) {
      const t = tabs.find((x) => x.id === id);
      if (t) Object.assign(t, { discarded: false, lastAccessed: Date.now() });
      tabEvents.onUpdated.emit();
    },
    async create({ url }: { url?: string } = {}) {
      if (!url || url.startsWith(location.origin)) return;
      tabs.push({
        id: nextId++, url, title: new URL(url).hostname, favIconUrl: fav(new URL(url).hostname),
        lastAccessed: Date.now(), active: false, audible: false, discarded: false, pinned: false,
      });
      tabEvents.onCreated.emit();
    },
  },
  search: {
    async query({ text }: { text: string }) {
      location.assign(`https://www.google.com/search?q=${encodeURIComponent(text)}`);
    },
  },
  storage: {
    onChanged: storageChanged,
    local: {
      async get(keys: string[]) {
        return Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]]));
      },
      async set(patch: Record<string, unknown>) {
        Object.assign(store, patch);
        storageChanged.emit();
      },
      async clear() {
        for (const k of Object.keys(store)) delete store[k];
        storageChanged.emit();
      },
    },
  },
};
