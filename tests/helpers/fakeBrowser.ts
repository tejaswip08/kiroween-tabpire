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
}

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
  /** Runs once, right after the next tabs.query. */
  afterQuery: undefined as undefined | (() => void),

  reset() {
    this.tabs.clear();
    this.storage.clear();
    this.calls.length = 0;
    this.badge = { text: undefined, color: undefined };
    this.alarms.length = 0;
    this.nextId = 1;
    this.failRemove.clear();
    this.failDiscard.clear();
    this.failCreate = false;
    this.failStorageSet.clear();
    this.failBadge = false;
    this.afterQuery = undefined;
    for (const e of [onAlarm, onInstalled, onStartup]) e.listeners.length = 0;
  },

  addTab(over: Partial<FakeTab> = {}): FakeTab {
    const tab: FakeTab = {
      id: this.nextId++,
      url: 'https://example.com/',
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
export const events = { onAlarm, onInstalled, onStartup };

const shouldFail = (set: Set<string>, id: number) => set.has('*') || set.has(String(id));

export const browser = {
  tabs: {
    async get(id: number) {
      const tab = fake.tabs.get(id);
      if (!tab) throw new Error(`No tab with id ${id}`);
      return { ...tab };
    },
    async query(_info: object) {
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
        if (!fake.tabs.delete(id)) throw new Error(`No tab with id ${id}`);
      }
    },
    async discard(id: number) {
      fake.calls.push(`discard:${id}`);
      if (shouldFail(fake.failDiscard, id)) throw new Error('discard failed');
      const tab = fake.tabs.get(id);
      if (!tab) throw new Error(`No tab with id ${id}`);
      tab.discarded = true;
      return { ...tab };
    },
    async create(props: { url?: string; active?: boolean }) {
      fake.calls.push(`create:${props.url}`);
      if (fake.failCreate) throw new Error('create failed');
      return { ...fake.addTab({ url: props.url, active: props.active ?? true }) };
    },
  },
  storage: {
    local: {
      async get(key: string) {
        return fake.storage.has(key) ? { [key]: fake.storage.get(key) } : {};
      },
      async set(items: Record<string, unknown>) {
        for (const [key, value] of Object.entries(items)) {
          fake.calls.push(`set:${key}`);
          if (fake.failStorageSet.has(key)) throw new Error('storage set failed');
          fake.storage.set(key, value);
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
  alarms: {
    create(name: string, info: unknown) {
      fake.alarms = fake.alarms.filter((a) => a.name !== name);
      fake.alarms.push({ name, info });
    },
    onAlarm,
  },
  runtime: { onInstalled, onStartup },
};
