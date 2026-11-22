import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(__dirname, '..', '.output');
const builds = ['chrome-mv3', 'firefox-mv3'].filter((b) => existsSync(join(OUT, b, 'manifest.json')));

function jsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsFiles(p) : n.endsWith('.js') ? [p] : [];
  });
}

// These check the build in .output. Run `npm run build` (and `npm run build:firefox`) first.
describe.skipIf(builds.length === 0)('built extension', () => {
  it.each(builds)('%s: the manifest allows WebAssembly for the meshopt decoder', (b) => {
    const m = JSON.parse(readFileSync(join(OUT, b, 'manifest.json'), 'utf8'));
    expect(m.content_security_policy.extension_pages).toContain("'wasm-unsafe-eval'");
    expect(m.content_security_policy.extension_pages).toContain("script-src 'self'");
  });
  it.each(builds)('%s: no built script mentions gstatic.com', (b) => {
    for (const f of jsFiles(join(OUT, b))) expect(readFileSync(f, 'utf8'), f).not.toContain('gstatic.com');
  });
});
