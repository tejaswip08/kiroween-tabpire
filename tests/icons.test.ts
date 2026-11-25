// The extension icons: four PNGs of the pink bat logo, used for the extension and the toolbar action.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SIZES = [16, 32, 48, 128];
const config = readFileSync('wxt.config.ts', 'utf8');

describe('extension icons', () => {
  it.each(SIZES)('public/icon/%i.png is an RGBA PNG of that size', (size) => {
    const png = readFileSync(`public/icon/${size}.png`);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
    expect(png[25]).toBe(6); // RGBA
  });
  it('are listed for the extension and for the toolbar action', () => {
    for (const size of SIZES) expect(config).toContain(`${size}: 'icon/${size}.png'`);
    expect(config).toMatch(/icons: ICONS/);
    expect(config).toMatch(/default_icon: ICONS/);
  });
});
