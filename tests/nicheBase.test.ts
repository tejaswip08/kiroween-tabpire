import { describe, expect, it } from 'vitest';
import { nicheBase } from '../entrypoints/newtab/layers/portraits/Niche';
import { THEME_IDS } from '../lib/themes';

describe('nicheBase', () => {
  it('Crypt equals the original shader literals exactly', () => {
    expect(nicheBase('crypt')).toEqual([[0.13, 0.07, 0.17], [0.17, 0.095, 0.22]]);
  });
  it('every theme gives finite values in 0..1', () => {
    for (const id of THEME_IDS) for (const c of nicheBase(id)) for (const v of c) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('at least one other theme differs from the Crypt', () => {
    const crypt = JSON.stringify(nicheBase('crypt'));
    expect(THEME_IDS.some((id) => id !== 'crypt' && JSON.stringify(nicheBase(id)) !== crypt)).toBe(true);
  });
});
