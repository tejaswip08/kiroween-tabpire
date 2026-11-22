import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const stylesDir = join(root, 'entrypoints', 'newtab', 'styles');

function files(dir: string, test: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, test);
    return test(name) ? [path] : [];
  });
}

// ---------- a small CSS reader ----------

interface Rule {
  selector: string;
  decls: { prop: string; value: string }[];
  inKeyframes: boolean;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function declsOf(body: string) {
  return body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .flatMap((d) => {
      const i = d.indexOf(':');
      return i < 0 ? [] : [{ prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim() }];
    });
}

function parse(css: string, inKeyframes = false): Rule[] {
  const rules: Rule[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (body.includes('{')) {
      const isKeyframes = /^@(-webkit-)?keyframes/i.test(prelude);
      rules.push(...parse(body, inKeyframes || isKeyframes));
    } else {
      rules.push({ selector: prelude, decls: declsOf(body), inKeyframes });
    }
    i = j;
  }
  return rules;
}

const sheets = files(stylesDir, (n) => n.endsWith('.css')).map((path) => ({
  path,
  name: path.slice(stylesDir.length + 1),
  rules: parse(stripComments(readFileSync(path, 'utf8'))),
}));
const allRules = sheets.flatMap((s) => s.rules.map((r) => ({ ...r, sheet: s.name })));

const SAFE = new Set(['transform', 'opacity']);

/** First word of each comma-separated transition item. */
function transitionProps(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      items.push(current);
      current = '';
    } else current += ch;
  }
  items.push(current);
  return items.map((item) => item.trim().split(/\s+/)[0]!.toLowerCase());
}

// ---------- the reader itself ----------

describe('the CSS reader used by these checks', () => {
  it('reads nested at-rules and keyframes', () => {
    const rules = parse(
      '@media (x) { .a { opacity: 0; } } @keyframes k { from { transform: none; } to { opacity: 1; } } .b { color: red; }',
    );
    expect(rules.map((r) => r.selector)).toEqual(['.a', 'from', 'to', '.b']);
    expect(rules.filter((r) => r.inKeyframes)).toHaveLength(2);
  });

  it('splits transition lists outside parentheses', () => {
    expect(transitionProps('transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.1s')).toEqual(['transform', 'opacity']);
  });

  it('finds stylesheets', () => {
    expect(sheets.length).toBeGreaterThan(0);
  });
});

// ---------- motion ----------

describe('animation rules (only transform and opacity)', () => {
  it('transitions list only transform or opacity, never all', () => {
    for (const rule of allRules) {
      for (const d of rule.decls) {
        if (d.prop === 'transition') {
          for (const p of transitionProps(d.value)) {
            if (p === 'none') continue;
            expect(SAFE.has(p), `${rule.sheet} ${rule.selector}: transition on "${p}"`).toBe(true);
          }
        }
        if (d.prop === 'transition-property') {
          for (const p of d.value.split(',').map((x) => x.trim().toLowerCase())) {
            if (p === 'none') continue;
            expect(SAFE.has(p), `${rule.sheet} ${rule.selector}: transition-property "${p}"`).toBe(true);
          }
        }
      }
    }
  });

  it('keyframes change only transform and opacity', () => {
    for (const rule of allRules.filter((r) => r.inKeyframes)) {
      for (const d of rule.decls) {
        const ok = SAFE.has(d.prop) || d.prop === 'animation-timing-function';
        expect(ok, `${rule.sheet} keyframe "${rule.selector}" sets ${d.prop}`).toBe(true);
      }
    }
  });

  it('will-change names only transform and opacity', () => {
    for (const rule of allRules) {
      for (const d of rule.decls.filter((x) => x.prop === 'will-change')) {
        for (const p of d.value.split(',').map((x) => x.trim())) {
          expect(SAFE.has(p) || p === 'auto', `${rule.sheet} ${rule.selector}: will-change ${p}`).toBe(true);
        }
      }
    }
  });
});

// ---------- blur ----------

describe('blur', () => {
  const blurred = allRules.flatMap((rule) =>
    rule.decls.filter((d) => /blur\(/i.test(d.value)).map((d) => ({ rule, d })),
  );

  it('appears only as a backdrop-filter on the stats panel, at most 10px', () => {
    for (const { rule, d } of blurred) {
      expect(['backdrop-filter', '-webkit-backdrop-filter'], `${rule.sheet} ${rule.selector}`).toContain(d.prop);
      expect(rule.selector, `${rule.sheet}: blur on ${rule.selector}`).toContain('.stats-panel');
      const radius = Number(/blur\(\s*([\d.]+)px\s*\)/i.exec(d.value)?.[1]);
      expect(radius).toBeGreaterThan(0);
      expect(radius).toBeLessThanOrEqual(10);
    }
  });

  it('is never used as a plain filter', () => {
    for (const rule of allRules) {
      for (const d of rule.decls) {
        if (d.prop === 'filter' || d.prop === '-webkit-filter') expect(d.value).not.toMatch(/blur\(/i);
      }
    }
  });

  it('is never animated', () => {
    for (const rule of allRules.filter((r) => r.inKeyframes)) {
      for (const d of rule.decls) expect(d.prop).not.toContain('filter');
    }
  });
});

// ---------- network ----------

describe('no remote assets or addresses', () => {
  it('stylesheets use no url() with a host name or protocol-relative address', () => {
    for (const sheet of sheets) {
      const text = stripComments(readFileSync(sheet.path, 'utf8'));
      for (const m of text.matchAll(/url\(\s*['"]?([^)'"]+)/gi)) {
        expect(m[1], `${sheet.name}: url(${m[1]})`).not.toMatch(/^(https?:)?\/\//i);
      }
      expect(text).not.toMatch(/@import\s+(url\()?['"]?(https?:)?\/\//i);
    }
  });

  const ALLOWED_HOSTS = ['suggestqueries.google.com'];
  const codeFiles = [
    ...files(join(root, 'lib'), (n) => /\.(ts|tsx)$/.test(n)),
    ...files(join(root, 'entrypoints'), (n) => /\.(ts|tsx|css|html)$/.test(n)),
  ];

  it('scans real files', () => {
    expect(codeFiles.length).toBeGreaterThan(5);
  });

  it('code mentions no web address with a host name except the suggestion address', () => {
    for (const path of codeFiles) {
      const text = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/^\s*\*.*$/gm, '');
      for (const m of text.matchAll(/https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
        expect(ALLOWED_HOSTS, `${path.slice(root.length)} mentions ${m[0]}`).toContain(m[1]!.toLowerCase());
      }
    }
  });

  it('only lib/google.ts calls fetch', () => {
    for (const path of codeFiles) {
      const text = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      if (path.endsWith(join('lib', 'google.ts'))) continue;
      expect(text, path.slice(root.length)).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
    }
  });
});
