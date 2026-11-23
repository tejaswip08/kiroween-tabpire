import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('newtab styles module', () => {
  const main = readFileSync('entrypoints/newtab/main.tsx', 'utf8');
  const styles = readFileSync('entrypoints/newtab/styles.ts', 'utf8');

  it('main.tsx imports ./styles and lists no CSS files', () => {
    expect(main).toMatch(/import '\.\/styles';/);
    expect(main).not.toMatch(/\.css'/);
  });

  it('styles.ts imports the fonts and every stylesheet in order', () => {
    const imports = [...styles.matchAll(/^import '([^']+)';/gm)].map((m) => m[1]);
    expect(imports[0]).toBe('@fontsource/grenze-gotisch/latin-800.css');
    expect(imports.slice(5)).toEqual(
      ['tokens', 'base', 'controls', 'header', 'search', 'haunts', 'cards', 'states', 'layers', 'toasts', 'fps'].map(
        (n) => `./styles/${n}.css`,
      ),
    );
  });
});
