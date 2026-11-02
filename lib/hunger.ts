// Pure hunger/appetite rules. No browser APIs here so it can be property-tested.

export type Stage = 'feeding' | 'fresh' | 'starving' | 'coffin' | 'garlic';

export interface TabLike {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  lastAccessed: number;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  pinned: boolean;
}

export interface Thresholds {
  starvingMs: number;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const DEFAULT_THRESHOLDS: Thresholds = { starvingMs: DAY };

// Rough per-site appetite in MB. Real per-tab memory isn't exposed to stable-channel extensions.
const HEAVY_HOSTS: Record<string, number> = {
  'youtube.com': 350,
  'figma.com': 500,
  'mail.google.com': 280,
  'docs.google.com': 220,
  'meet.google.com': 400,
  'twitch.tv': 380,
  'netflix.com': 420,
  'slack.com': 300,
  'discord.com': 300,
  'notion.so': 240,
};
const BASE_MB = 80;
const AUDIBLE_EXTRA_MB = 150;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function idleMs(tab: TabLike, now: number): number {
  return tab.active ? 0 : Math.max(0, now - tab.lastAccessed);
}

export function stageOf(
  tab: TabLike,
  now: number,
  garlic: ReadonlySet<string>,
  t: Thresholds = DEFAULT_THRESHOLDS,
): Stage {
  if (garlic.has(hostOf(tab.url))) return 'garlic';
  if (tab.discarded) return 'coffin';
  if (tab.active || tab.audible) return 'feeding';
  const idle = idleMs(tab, now);
  if (idle >= t.starvingMs) return 'starving';
  return 'fresh';
}

/** 0 = rosy, 1 = corpse-grey. */
export function pallor(tab: TabLike, now: number, t: Thresholds = DEFAULT_THRESHOLDS): number {
  return Math.min(1, idleMs(tab, now) / t.starvingMs);
}

export function appetiteMb(tab: TabLike): number {
  if (tab.discarded) return 0;
  const host = hostOf(tab.url);
  const match = Object.keys(HEAVY_HOSTS).find((h) => host === h || host.endsWith('.' + h));
  return (match ? (HEAVY_HOSTS[match] ?? BASE_MB) : BASE_MB) + (tab.audible ? AUDIBLE_EXTRA_MB : 0);
}

/** Tabs Dawn will burn: starving, never pinned, never protected. */
export function dawnTargets(
  tabs: readonly TabLike[],
  now: number,
  garlic: ReadonlySet<string>,
  t: Thresholds = DEFAULT_THRESHOLDS,
): TabLike[] {
  return tabs.filter((tab) => !tab.pinned && stageOf(tab, now, garlic, t) === 'starving');
}

const RANKS: [number, string][] = [
  [0, 'Novice hunter'],
  [10, 'Garlic bearer'],
  [50, 'Stake wielder'],
  [150, 'Slayer'],
  [500, 'Van Helsing'],
];

export function rankFor(slain: number): string {
  let name = 'Novice hunter';
  for (const [min, r] of RANKS) if (slain >= min) name = r;
  return name;
}

export function formatIdle(ms: number): string {
  if (ms < 60_000) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / 60_000)} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h`;
  const d = Math.floor(ms / DAY);
  return `${d} day${d === 1 ? '' : 's'}`;
}

export function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
