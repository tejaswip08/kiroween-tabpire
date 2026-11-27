import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const yml = readFileSync('.github/workflows/pages.yml', 'utf8');
const lines = yml.split('\n');
const at = (needle: string) => {
  const i = lines.findIndex((l) => l.includes(needle));
  expect(i, `missing "${needle}"`).toBeGreaterThanOrEqual(0);
  return i;
};

describe('Pages workflow', () => {
  it('triggers on push to main and manual dispatch', () => {
    expect(yml).toMatch(/push:\s*\n\s+branches:\s*\[main\]/);
    expect(yml).toMatch(/^\s*workflow_dispatch:/m);
  });

  it('requests exactly the three permissions', () => {
    const start = at('permissions:');
    const block: string[] = [];
    for (const l of lines.slice(start + 1)) {
      if (!/^\s+\S/.test(l)) break;
      block.push(l.trim());
    }
    expect(block).toEqual(['contents: read', 'pages: write', 'id-token: write']);
    expect(yml.match(/^\s*permissions:/gm)).toHaveLength(1);
  });

  it('uses a pages concurrency group', () => {
    expect(yml).toMatch(/concurrency:\s*\n\s+group: pages/);
  });

  it('builds, tests, then uploads demo/dist', () => {
    const order = [
      'actions/checkout@v7',
      'actions/setup-node@v7',
      'npm ci',
      'npm run typecheck',
      'npm run demo:build',
      'npm test',
      'actions/configure-pages@v5',
      'actions/upload-pages-artifact@v3',
    ].map(at);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(yml).toMatch(/path: demo\/dist/);
    expect(yml).toMatch(/cache: npm/);
  });

  it('deploys only after build, in the github-pages environment', () => {
    expect(yml).toMatch(/deploy:\s*\n\s+needs: build/);
    expect(yml).toMatch(/name: github-pages/);
    expect(yml).toContain('actions/deploy-pages@v4');
    expect(at('actions/deploy-pages@v4')).toBeGreaterThan(at('deploy:'));
  });

  it('names the Pages source and uses no secrets', () => {
    expect(yml).toMatch(/#.*"GitHub Actions"/);
    expect(yml).not.toMatch(/secrets\./);
  });
});
