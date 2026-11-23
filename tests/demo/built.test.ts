import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const DIST = join(ROOT, 'demo', 'dist');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Prefixes of addresses that appear as strings in the bundle but are never fetched. Library code is not stripped.
const ALLOWED_PREFIXES = [
  'http://www.w3.org/', // SVG, XLink, XML, MathML and XHTML namespace identifiers used by React DOM
  'https://react.dev/errors', // React error decoder link, only printed inside an error message
  'https://github.com/pmndrs/react-three-fiber', // r3f error messages and package metadata links
  'https://github.com/react-spring/react-use-measure', // comment-like link in a react-use-measure warning
  'https://github.com/drcmda', // r3f author links in bundled package text
  'https://github.com/joshuaellis', // r3f author links in bundled package text
  'https://github.com/krispya', // r3f author links in bundled package text
  'https://github.com/codyjasonbennett', // r3f author links in bundled package text
  'https://opencollective.com/react-three-fiber', // funding link in the bundled r3f console message
  'https://docs.pmnd.rs/react-three-fiber', // r3f docs link inside an error message
  'https://github.com/vitejs/vite/issues', // Vite preload helper comment/error text, never fetched
  'https://example.com', // placeholder host in a library's URL parsing code
  'https://${', // template literal in the Add page URL normaliser that prefixes a typed host; the address is the user's own input
  // Dead strings from Haunts.tsx. Real use is gated by `capabilities`, which the demo turns off (tested in network.test.ts).
  'https://icons.duckduckgo.com/ip3/', // favicon fallback, unreachable when capabilities.remoteFavicons is off
  'https://suggestqueries.google.com', // search suggestion endpoint, unreachable when capabilities.remoteSuggestions is off
];

// The fake tabs, Crypt entries and bookmarks in demo/src/seed.ts. They are data shown on screen, never requested.
const seedUrls = new Set(readFileSync(join(ROOT, 'demo', 'src', 'seed.ts'), 'utf8').match(/https?:\/\/[^'"`\s)]+/g) ?? []);

const TEXT_EXT = /\.(html|js|css|json)$/;
const ADDRESS = /(?:https?|wss?):\/\/[^\s'"`<>\\)(]*|(?<![:\w/.\\*<>])\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s'"`<>\\)(]*/gi;

function isAllowed(u: string): boolean {
  if (seedUrls.has(u)) return true;
  return ALLOWED_PREFIXES.some((p) => u.startsWith(p));
}

// The '_favicon' path string from Haunts.tsx is also bundled but unreachable: capabilities.remoteIcons is off in the demo.
// Run `npm run demo:build` first. Skipped when demo/dist is missing.
describe.skipIf(!existsSync(join(DIST, 'index.html')))('built demo (demo/dist)', () => {
  const files = existsSync(DIST) ? walk(DIST).filter((f) => TEXT_EXT.test(f)) : [];

  it('contains text files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no external address outside the allowlist', () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(ADDRESS)) {
        const u = m[0].replace(/[.,;:]+$/, '');
        if (!isAllowed(u)) bad.push(`${relative(DIST, f)}: ${u}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('index.html uses relative asset paths and no remote script or link', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<script[^>]*\ssrc=["'](?:https?:)?\/\//i);
    expect(html).not.toMatch(/<link[^>]*\shref=["'](?:https?:)?\/\//i);
    expect(html).not.toMatch(/\s(?:src|href)=["']\/(?!\/)/i);
    expect(html).toContain('./assets/');
  });

  it('no built file mentions gstatic.com (Draco CDN)', () => {
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toContain('gstatic.com');
    }
  });

  it('demo/dist/models has every file under public/models', () => {
    const src = join(ROOT, 'public', 'models');
    for (const f of walk(src)) expect(existsSync(join(DIST, 'models', relative(src, f))), f).toBe(true);
  });
});
