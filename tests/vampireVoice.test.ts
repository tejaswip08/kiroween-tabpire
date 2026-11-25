import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../lib/hunger';
import { countByState, filterByState, toggleFilter } from '../lib/legend';
import { STATE_EXPLANATION, STATE_HINT, STATE_ORDER, hungerPercent, hungerShare, lastUsedText, shortAge } from '../lib/vampireVoice';

const H = 60 * 60 * 1000;
const M = 60 * 1000;
const idle = (ms: number) => ({ active: false, audible: false, lastAccessed: 1000 + ms });

describe('hunger', () => {
  it('is the idle time over one day, from 0 to 1', () => {
    expect(hungerShare(0)).toBe(0);
    expect(hungerShare(DAY_MS / 2)).toBe(0.5);
    expect(hungerShare(5 * DAY_MS)).toBe(1);
    expect(hungerShare(-5)).toBe(0);
    expect(hungerShare(Number.NaN)).toBe(0);
  });
  it('is shown as a whole percent', () => {
    expect(hungerPercent(15.84 * H)).toBe(66);
    expect(hungerPercent(0)).toBe(0);
    expect(hungerPercent(3 * DAY_MS)).toBe(100);
  });
});

describe('times', () => {
  it.each([
    [30 * 1000, '<1 min'],
    [25 * M, '25 min'],
    [17 * H + 20 * M, '17 h'],
    [3 * DAY_MS + H, '3 d'],
  ])('%d ms is shown as %s', (ms, text) => {
    expect(shortAge(ms, idle(ms))).toBe(text);
  });
  it('says now for a tab in use and ? when unknown', () => {
    expect(shortAge(5 * DAY_MS, { active: true, audible: false, lastAccessed: 1 })).toBe('now');
    expect(shortAge(0, { active: false, audible: false, lastAccessed: undefined })).toBe('?');
  });
  it('writes the Last used line', () => {
    expect(lastUsedText(15 * H, idle(15 * H))).toBe('15 h ago');
    expect(lastUsedText(10 * 1000, idle(10 * 1000))).toBe('Just now');
    expect(lastUsedText(0, { active: false, audible: true, lastAccessed: 1 })).toBe('In use now');
    expect(lastUsedText(0, { active: false, audible: false, lastAccessed: undefined })).toBe('Unknown');
  });
});

describe('state words', () => {
  it('has a plain explanation and a hint for every state', () => {
    for (const st of STATE_ORDER) {
      expect(STATE_EXPLANATION[st].length).toBeGreaterThan(10);
      expect(STATE_HINT[st].length).toBeGreaterThan(0);
    }
  });
});
describe('legend', () => {
  const cards = [{ state: 'awake' as const }, { state: 'awake' as const }, { state: 'starving' as const }, { state: 'protected' as const }];
  it('counts every state, including empty ones', () => {
    expect(countByState(cards)).toEqual({ awake: 2, starving: 1, asleep: 0, protected: 1 });
  });
  it('filters to one state and keeps the order, or returns all', () => {
    expect(filterByState(cards, 'awake')).toHaveLength(2);
    expect(filterByState(cards, 'asleep')).toHaveLength(0);
    expect(filterByState(cards, null)).toEqual(cards);
  });
  it('clicking the chosen chip again clears the filter', () => {
    expect(toggleFilter(null, 'awake')).toBe('awake');
    expect(toggleFilter('awake', 'awake')).toBeNull();
    expect(toggleFilter('awake', 'starving')).toBe('starving');
  });
});
