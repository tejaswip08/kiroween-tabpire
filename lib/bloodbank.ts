// What the Blood Bank page shows, worked out from the stored data. Pure: no DOM, no browser APIs, time passed in.
import { formatMb, rankFor, siteOf } from './hunger';
import type { CryptEntry, LogAction, LogEntry, Stats } from './store';

/** The words of each hunt log row. */
export const LOG_WORD: Record<LogAction, string> = {
  stake: 'Staked',
  coffin: 'Coffined',
  crypt: 'Sent to crypt',
  resurrect: 'Resurrected',
  garlic: 'Garlic',
  dawn: 'Dawn',
};

export interface LogRow {
  key: string;
  action: LogAction;
  /** "Staked", "Coffined", ... */
  word: string;
  /** The tab title, or its site. */
  what: string;
  time: string;
  /** "~450 MB", or empty when the entry freed nothing. */
  mb: string;
}

/** "14:05" today, "Yesterday 09:12", or "3 Nov 18:40". */
export function logTime(at: number, now: number): string {
  const d = new Date(at);
  const n = new Date(now);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(n) - day(d)) / 86_400_000);
  if (days <= 0) return hm;
  if (days === 1) return `Yesterday ${hm}`;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${d.getDate()} ${month} ${hm}`;
}

/** The hunt log, newest first. */
export function logRows(log: readonly LogEntry[], now: number, limit = 100): LogRow[] {
  return [...log]
    .map((e, i) => ({ e, i }))
    .reverse()
    .slice(0, limit)
    .map(({ e, i }) => ({
      key: `${e.at}-${i}`,
      action: e.action,
      word: LOG_WORD[e.action],
      what: e.title?.trim() || e.site || 'a tab',
      time: logTime(e.at, now),
      mb: e.mb !== undefined && e.mb > 0 ? formatMb(e.mb) : '',
    }));
}

/** Saved tabs that match the search text (title, address or site), newest first. */
export function searchCrypt(items: readonly CryptEntry[], query: string): CryptEntry[] {
  const q = query.trim().toLowerCase();
  const sorted = [...items].sort((a, b) => b.savedAt - a.savedAt);
  if (!q) return sorted;
  return sorted.filter((i) => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q) || (siteOf(i.url) ?? '').includes(q));
}

export interface BankTotals {
  reclaimed: string;
  slain: number;
  coffined: number;
  rank: string;
  /** From 0 to 1: how far to the next rank. */
  progress: number;
  /** "3 more slain for the next rank", or the top rank line. */
  rankNote: string;
}

export function bankTotals(stats: Stats): BankTotals {
  const rank = rankFor(stats.staked);
  const progress = rank.next === null ? 1 : Math.min(1, Math.max(0, (stats.staked - rank.from) / (rank.next - rank.from)));
  return {
    reclaimed: formatMb(stats.mbFreed),
    slain: stats.staked,
    coffined: stats.coffined,
    rank: rank.name,
    progress,
    rankNote: rank.next === null ? 'You have reached the top rank.' : `${rank.next - stats.staked} more slain for the next rank.`,
  };
}

export const EMPTY_LOG_TEXT = 'No hunts yet. Open a new tab to meet your vampires.';
export const EMPTY_GARLIC_TEXT = 'None yet. Hang garlic on a vampire to protect its site.';
export const BANK_SUB = 'Everything you\u2019ve reclaimed from the vampires. Stored only in this browser.';
