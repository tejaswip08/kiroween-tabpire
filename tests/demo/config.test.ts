import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('demo build config', () => {
  const config = read('demo/vite.config.ts');
  const pkg = JSON.parse(read('package.json'));

  it('uses a relative base and the shared public folder', () => {
    expect(config).toMatch(/base:\s*'\.\/'/);
    expect(config).toMatch(/publicDir:\s*'\.\.\/public'/);
  });
  it('aliases wxt/browser to the fake and lists noRemoteDraco', () => {
    expect(config).toMatch(/'wxt\/browser'/);
    expect(config).toContain('lib/fakeBrowser.ts');
    expect(config).toMatch(/plugins:\s*\[[^\]]*noRemoteDraco/);
  });
  it('has the demo scripts', () => {
    expect(pkg.scripts['demo:dev']).toBe('vite --config demo/vite.config.ts');
    expect(pkg.scripts['demo:build']).toBe('vite build --config demo/vite.config.ts');
  });
});
