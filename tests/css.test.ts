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

/** Splits on `;` but not inside quotes or brackets, so data addresses stay whole. */
function splitDecls(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ';' && depth <= 0 && !quote) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out;
}
function declsOf(body: string) {
  return splitDecls(body)
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

  it('keeps a semicolon inside quotes and brackets', () => {
    const rules = parse('.a { --x: url("data:image/svg+xml;utf8,%3Csvg%3E"); mask: url(a;b) 1px; color: red; }');
    expect(rules[0]!.decls.map((d) => d.prop)).toEqual(['--x', 'mask', 'color']);
    expect(rules[0]!.decls[0]!.value).toContain('svg+xml;utf8');
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
// ---------- the portrait hole ----------
describe('portrait hole in the card surface', () => {
  const holeRules = allRules.filter((r) => r.sheet === 'cards.css' && r.selector.includes("[data-3d='on']::before"));
  const decl = (rule: (typeof allRules)[number], prop: string) => rule.decls.find((d) => d.prop === prop)?.value ?? '';
  it('is cut with an excluded mask, only when the browser supports it', () => {
    expect(holeRules.length).toBe(1);
    const rule = holeRules[0]!;
    expect(decl(rule, 'mask-composite')).toBe('exclude');
    expect(decl(rule, 'mask')).toMatch(/linear-gradient\(#000 0 0\)/);
    const css = readFileSync(join(stylesDir, 'cards.css'), 'utf8');
    expect(css).toMatch(/@supports \(mask-composite: exclude\)\s*\{[^@]*\.card\[data-3d='on'\]::before/);
  });
  it('uses a data address with no host name and a 96 x 112 arch', () => {
    const shape = decl(holeRules[0]!, '--hole-shape');
    expect(shape).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(shape).not.toMatch(/https?:|\/\/[a-z]/i);
    expect(decodeURIComponent(shape)).toContain("width='96' height='112'");
  });
  it('places the hole from the card own border, padding and header height', () => {
    const card = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.card')!;
    expect(decl(card, '--hole-x')).toBe('calc(var(--card-border) + var(--card-pad-x))');
    expect(decl(card, '--hole-y')).toBe('calc(var(--card-border) + var(--card-pad-top) + var(--head-h) + var(--card-gap))');
    expect(decl(card, 'padding')).toContain('var(--card-pad-x)');
    expect(decl(card, 'border')).toContain('var(--card-border)');
    expect(decl(card, 'gap')).toBe('var(--card-gap)');
    const head = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.card-head')!;
    expect(decl(head, 'height')).toBe('var(--head-h)');
  });
  it('keeps the outer shadows on the card and the surface on ::before', () => {
    const card = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.card')!;
    const before = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.card::before')!;
    expect(decl(card, 'box-shadow')).toBe('var(--shadow-card-outer)');
    expect(decl(card, 'background')).toBe('');
    expect(decl(before, 'box-shadow')).toContain('var(--shadow-card-inset)');
    expect(decl(before, 'box-shadow')).toContain('var(--rim)');
    expect(decl(before, 'background')).toContain('var(--card-top)');
    expect(decl(before, 'z-index')).toBe('-1');
  });
  it('fades the 2D emblem with opacity only', () => {
    const fade = allRules.find((r) => r.sheet === 'cards.css' && r.selector === ".card[data-3d='on'] .portrait-slot .emblem")!;
    expect(decl(fade, 'opacity')).toBe('0');
    const emblem = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.portrait-slot .emblem')!;
    expect(decl(emblem, 'transition')).toMatch(/^opacity /);
  });
});
