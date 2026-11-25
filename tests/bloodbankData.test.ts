import { describe, expect, it } from 'vitest';
import { LOG_WORD, bankTotals, logRows, logTime, searchCrypt } from '../lib/bloodbank';

describe('Blood Bank data', () => {
  it('names every action as the prototype does', () => {
    expect(LOG_WORD).toEqual({ stake: 'Staked', coffin: 'Coffined', crypt: 'Sent to crypt', resurrect: 'Resurrected', garlic: 'Garlic', dawn: 'Dawn' });
  });
  it('writes the time as a clock today, "Yesterday" and a date before', () => {
    const now = new Date(2026, 9, 31, 20, 0).getTime();
    expect(logTime(new Date(2026, 9, 31, 9, 5).getTime(), now)).toBe('09:05');
    expect(logTime(new Date(2026, 9, 30, 23, 59).getTime(), now)).toBe('Yesterday 23:59');
    expect(logTime(new Date(2026, 9, 3, 18, 40).getTime(), now)).toBe('3 Oct 18:40');
  });
  it('lists the log newest first, with the title or site and its memory', () => {
    const rows = logRows(
      [
        { at: 1, action: 'stake', site: 'a.com', title: 'A', mb: 450 },
        { at: 2, action: 'resurrect', site: 'b.com' },
      ],
      3,
    );
    expect(rows.map((r) => [r.word, r.what, r.mb])).toEqual([
      ['Resurrected', 'b.com', ''],
      ['Staked', 'A', '~450 MB'],
    ]);
  });
  it('searches saved tabs by title, address and site, newest first', () => {
    const items = [
      { id: '1', url: 'https://mail.google.com/x', title: 'Inbox', savedAt: 1 },
      { id: '2', url: 'https://claude.ai/', title: 'Claude chat', savedAt: 2 },
    ];
    expect(searchCrypt(items, '').map((i) => i.id)).toEqual(['2', '1']);
    expect(searchCrypt(items, 'GOOGLE').map((i) => i.id)).toEqual(['1']);
    expect(searchCrypt(items, 'chat').map((i) => i.id)).toEqual(['2']);
  });
  it('totals the stats and the rank progress', () => {
    const t = bankTotals({ staked: 0, coffined: 2, crypted: 1, dawns: 0, mbFreed: 1200 });
    expect(t).toMatchObject({ reclaimed: '~1.2 GB', slain: 0, coffined: 2 });
    expect(t.progress).toBe(0);
    expect(t.rankNote).toMatch(/more slain for the next rank\.$/);
  });
});
