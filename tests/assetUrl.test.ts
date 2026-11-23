import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { assetUrl } from '../lib/assetUrl';

afterEach(() => vi.unstubAllEnvs());

const bases = ['/', './', '/repo/'] as const;
// Where a page built for each base is served, so relative bases can be resolved.
const pageAt: Record<(typeof bases)[number], string> = {
  '/': 'https://demo.test/',
  './': 'https://demo.test/repo/',
  '/repo/': 'https://demo.test/repo/',
};
const modelFile = fc.stringMatching(/^[a-z][a-z0-9_]{0,10}\.glb$/);

describe('assetUrl', () => {
  it('defaults to / when BASE_URL is empty', () => {
    vi.stubEnv('BASE_URL', '');
    expect(assetUrl('models/coffin.glb')).toBe('/models/coffin.glb');
  });

  it('keeps the extension address with the default base', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(assetUrl('/models/coffin.glb')).toBe('/models/coffin.glb');
  });

  // Feature: web-demo, Property 2: Asset addresses resolve under the base
  // **Validates: Requirements 1.4, 9.2**
  it('Property 2: asset addresses resolve under the base', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...bases),
        modelFile,
        fc.constantFrom('', '/', '//'),
        (base, file, lead) => {
          vi.stubEnv('BASE_URL', base);
          const url = assetUrl(`${lead}models/${file}`);
          expect(url.startsWith(base)).toBe(true);
          expect(url.slice(base.length)).not.toMatch(/^\//);
          expect(url.slice(1)).not.toContain('//');
          expect(url).toBe(`${base}models/${file}`);
          const page = pageAt[base];
          const resolved = new URL(url, page).href;
          const modelsDir = new URL(`${base}models/`, page).href;
          expect(resolved.startsWith(modelsDir)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
