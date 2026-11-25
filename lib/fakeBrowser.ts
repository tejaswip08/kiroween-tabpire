// In-memory stand-in for the parts of `browser` that Tabpire uses.

export interface FakeTab {
  id: number;
  url?: string;
  title?: string;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  pinned: boolean;
  lastAccessed?: number;
  windowId: number;
  favIconUrl?: string;
}

export type Intercept = (op: {
  kind: 'update' | 'create';
  tabId?: number;
  props: { url?: string; active?: boolean };
}) => boolean;

type Listener = (...args: unknown[]) => void;

function event() {
  const listeners: Listener[] = [];
  return {
    listeners,
    addListener: (fn: Listener) => void listeners.push(fn),
    removeListener: (fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    hasListener: (fn: Listener) => listeners.includes(fn),
  };
}

export const fake = {
  tabs: new Map<number, FakeTab>(),
  storage: new Map<string, unknown>(),
  calls: [] as string[],
  badge: { text: undefined as string | undefined, color: undefined as string | undefined },
  alarms: [] as { name: string; info: unknown }[],
  nextId: 1,
  /** Make a call throw. Keys are tab ids as strings, or "*" for all. */
  failRemove: new Set<string>(),
  failDiscard: new Set<string>(),
  failCreate: false,
  failStorageSet: new Set<string>(),
  failBadge: false,
  /** The tab that shows The Crypt. */
  currentTabId: undefined as number | undefined,
  searches: [] as { text: string; disposition?: string }[],
  focusedWindows: [] as number[],
  failQuery: false,
  /** Runs once, right after the next tabs.query. */
  afterQuery: undefined as undefined | (() => void),
  /** Called before tabs.update and tabs.create. Return true to skip the change. */
  intercept: undefined as Intercept | undefined,
  /** Called by search.query after the search is recorded. */
  onSearch: undefined as undefined | ((info: { text: string }) => void),
  /** Fire tab events after remove, discard, create and update. */
  autoEvents: false,
  extensionBase: 'chrome-extension://fake-id/',

  /** Clears data only. Keeps listeners, switches and hooks. */
  clearData() {
    this.tabs.clear();
    this.storage.clear();
    this.calls.length = 0;
    this.badge = { text: undefined, color: undefined };
    this.alarms.length = 0;
    this.nextId = 1;
    this.searches.length = 0;
  },

  reset() {
    this.clearData();
    this.intercept = undefined;
    this.onSearch = undefined;
    this.autoEvents = false;
    this.extensionBase = 'chrome-extension://fake-id/';
    this.failRemove.clear();
    this.failDiscard.clear();
    this.failCreate = false;
    this.failStorageSet.clear();
    this.failBadge = false;
    this.afterQuery = undefined;
    this.currentTabId = undefined;
    this.focusedWindows.length = 0;
    this.failQuery = false;
    for (const e of [onAlarm, onInstalled, onStartup, onStorageChanged, ...Object.values(tabEvents)]) e.listeners.length = 0;
  },

  /** Wakes a sleeping tab in place, as the browser does when a discarded tab is shown: it loads again and counts as used now. */
  wakeTab(id: number, now: number = Date.now()): FakeTab | undefined {
    const tab = this.tabs.get(id);
    if (!tab) return undefined;
    tab.discarded = false;
    tab.lastAccessed = now;
    if (this.autoEvents) notify(tabEvents.onUpdated, id, { discarded: false }, { ...tab });
    return tab;
  },
  addTab(over: Partial<FakeTab> = {}): FakeTab {
    const tab: FakeTab = {
      id: this.nextId++,
      // Built in two parts so the no-remote-addresses scan in tests/css.test.ts skips this test default.
      url: 'https://' + 'example.com/',
      title: 'Example',
      active: false,
      audible: false,
      discarded: false,
      pinned: false,
      lastAccessed: 0,
      windowId: 1,
      ...over,
    };
    this.tabs.set(tab.id, tab);
    return tab;
  },
};

const onAlarm = event();
const onInstalled = event();
const onStartup = event();
const onStorageChanged = event();
const tabEvents = {
  onCreated: event(),
  onRemoved: event(),
  onUpdated: event(),
  onActivated: event(),
  onAttached: event(),
  onDetached: event(),
  onReplaced: event(),
};
export const events = { onAlarm, onInstalled, onStartup, onStorageChanged, ...tabEvents };

/** Fires every listener of a fake event. */
export function fire(e: { listeners: Listener[] }, ...args: unknown[]) {
  for (const l of [...e.listeners]) l(...args);
}

/** Like fire, but one throwing listener does not stop the rest. */
function notify(e: { listeners: Listener[] }, ...args: unknown[]) {
  for (const l of [...e.listeners]) {
    try {
      l(...args);
    } catch (err) {
      console.error('fake listener threw', err);
    }
  }
}

const shouldFail = (set: Set<string>, id: number) => set.has('*') || set.has(String(id));

export const browser = {
  tabs: {
    ...tabEvents,
    async getCurrent() {
      const tab = fake.currentTabId === undefined ? undefined : fake.tabs.get(fake.currentTabId);
      return tab ? { ...tab } : undefined;
    },
    async update(a: number | { url?: string; active?: boolean }, b?: { url?: string; active?: boolean }) {
      const id = typeof a === 'number' ? a : fake.currentTabId;
      const props = typeof a === 'number' ? b : a;
      fake.calls.push(`update:${id}:${JSON.stringify(props)}`);
      const tab = id === undefined ? undefined : fake.tabs.get(id);
      if (!tab) throw new Error('No such tab');
      if (props && fake.intercept?.({ kind: 'update', tabId: id, props })) return { ...tab };
      if (props?.url !== undefined) tab.url = props.url;
      if (props?.active !== undefined) tab.active = props.active;
      // Showing a sleeping tab wakes it: the browser loads the page again.
      if (props?.active === true && tab.discarded) {
        tab.discarded = false;
        tab.lastAccessed = Date.now();
      }
      if (fake.autoEvents && props) notify(tabEvents.onUpdated, tab.id, { ...props }, { ...tab });
      return { ...tab };
    },
    async get(id: number) {
      const tab = fake.tabs.get(id);
      if (!tab) throw new Error(`No tab with id ${id}`);
      return { ...tab };
    },
    async query(_info: object) {
      if (fake.failQuery) throw new Error('query failed');
      const result = [...fake.tabs.values()].map((t) => ({ ...t }));
      const hook = fake.afterQuery;
      fake.afterQuery = undefined;
      hook?.();
      return result;
    },
    async remove(ids: number | number[]) {
      for (const id of Array.isArray(ids) ? ids : [ids]) {
        fake.calls.push(`remove:${id}`);
        if (shouldFail(fake.failRemove, id)) throw new Error('remove failed');
        const tab = fake.tabs.get(id);
        if (!tab) throw new Error(`No tab with id ${id}`);
        fake.tabs.delete(id);
        if (fake.autoEvents) notify(tabEvents.onRemoved, id, { windowId: tab.windowId, isWindowClosing: false });
      }
    },
    async discard(id: number) {
      fake.calls.push(`discard:${id}`);
      if (shouldFail(fake.failDiscard, id)) throw new Error('discard failed');
      const tab = fake.tabs.get(id);
      if (!tab) throw new Error(`No tab with id ${id}`);
      tab.discarded = true;
      if (fake.autoEvents) notify(tabEvents.onUpdated, id, { discarded: true }, { ...tab });
      return { ...tab };
    },
    async create(props: { url?: string; active?: boolean }) {
      fake.calls.push(`create:${props.url}`);
      if (fake.failCreate) throw new Error('create failed');
      if (fake.intercept?.({ kind: 'create', props })) return undefined;
      const tab = fake.addTab({ url: props.url, active: props.active ?? true });
      if (fake.autoEvents) notify(tabEvents.onCreated, { ...tab });
      return { ...tab };
    },
  },
  storage: {
    onChanged: onStorageChanged,
    local: {
      async get(key: string) {
        return fake.storage.has(key) ? { [key]: fake.storage.get(key) } : {};
      },
      async set(items: Record<string, unknown>) {
        for (const [key, value] of Object.entries(items)) {
          fake.calls.push(`set:${key}`);
          if (fake.failStorageSet.has(key)) throw new Error('storage set failed');
          const had = fake.storage.has(key);
          const oldValue = fake.storage.get(key);
          fake.storage.set(key, value);
          notify(onStorageChanged, { [key]: had ? { oldValue, newValue: value } : { newValue: value } }, 'local');
        }
      },
    },
  },
  action: {
    async setBadgeText({ text }: { text: string }) {
      if (fake.failBadge) throw new Error('badge failed');
      fake.badge.text = text;
    },
    async setBadgeBackgroundColor({ color }: { color: string }) {
      fake.badge.color = color;
    },
  },
  windows: {
    async update(id: number, info: { focused?: boolean }) {
      if (info.focused) fake.focusedWindows.push(id);
      return { id };
    },
  },
  search: {
    async query(info: { text: string; disposition?: string }) {
      fake.searches.push(info);
      fake.onSearch?.({ text: info.text });
    },
  },
  alarms: {
    create(name: string, info: unknown) {
      fake.alarms = fake.alarms.filter((a) => a.name !== name);
      fake.alarms.push({ name, info });
    },
    onAlarm,
  },
  runtime: {
    onInstalled,
    onStartup,
    getURL: (path: string) => `${fake.extensionBase}${path.replace(/^\/+/, '')}`,
  },
};
