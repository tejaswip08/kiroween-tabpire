import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const ALLOWED = join('lib', 'themeCache.ts');

function walk(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' || n === 'dist' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

describe('localStorage use', () => {
  const files = ['lib', 'entrypoints', join('demo', 'src')].flatMap((d) => walk(join(root, d)));

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('only lib/themeCache.ts uses localStorage or sessionStorage', () => {
    const offenders = files
      .filter((f) => relative(root, f) !== ALLOWED)
      .filter((f) => /\b(localStorage|sessionStorage)\b/.test(strip(readFileSync(f, 'utf8'))))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });

  it('themeCache.ts does use localStorage (the scan is live)', () => {
    expect(strip(readFileSync(join(root, ALLOWED), 'utf8'))).toContain('localStorage');
  });

  it('lib/fakeBrowser.ts does not import the cache', () => {
    const text = strip(readFileSync(join(root, 'lib', 'fakeBrowser.ts'), 'utf8'));
    expect(text).not.toMatch(/themeCache/);
  });
});
