import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SURFACE_TOKENS, THEME_IDS, themeById } from '../lib/themes';

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

  // The "+N more" panel and its backdrop were asked to be frosted glass; they exist only while the panel is open.
  it('appears only as a backdrop-filter on the stats panel and the hidden tabs panel, at most 10px', () => {
    for (const { rule, d } of blurred) {
      expect(['backdrop-filter', '-webkit-backdrop-filter'], `${rule.sheet} ${rule.selector}`).toContain(d.prop);
      expect(rule.selector, `${rule.sheet}: blur on ${rule.selector}`).toMatch(/\.stats-panel|\.hidden-panel|\.hidden-backdrop/);
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

  const ALLOWED_HOSTS = ['suggestqueries.google.com', 'icons.duckduckgo.com'];
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
  it('uses a data address with no host name and a 190 x 170 arch', () => {
    const shape = decl(holeRules[0]!, '--hole-shape');
    expect(shape).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(shape).not.toMatch(/https?:|\/\/[a-z]/i);
    expect(decodeURIComponent(shape)).toContain("width='190' height='170'");
  });
  it('places the hole from the card own border and padding', () => {
    const card = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.card')!;
    expect(decl(card, '--hole-x')).toBe('calc(var(--card-border) + var(--card-pad-x))');
    expect(decl(card, '--hole-y')).toBe('calc(var(--card-border) + var(--card-pad-top))');
    expect(decl(card, 'padding')).toContain('var(--card-pad-x)');
    expect(decl(card, 'border')).toContain('var(--card-border)');
    expect(decl(card, 'gap')).toBe('var(--card-gap)');
    // The portrait slot is exactly the size of the hole.
    const slot = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.portrait-slot')!;
    expect(decl(slot, 'width')).toBe('var(--slot-w)');
    expect(decl(slot, 'height')).toBe('var(--slot-h)');
    expect(decl(card, '--slot-w')).toBe('190px');
    expect(decl(card, '--slot-h')).toBe('170px');
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
describe('card popup', () => {
  it('takes no clicks, so it never blocks a card button', () => {
    const popup = allRules.find((r) => r.sheet === 'cards.css' && r.selector === '.card-popup')!;
    expect(popup.decls.find((d) => d.prop === 'pointer-events')?.value).toBe('none');
    expect(popup.decls.find((d) => d.prop === 'position')?.value).toBe('fixed');
  });
  it('keeps the page from scrolling', () => {
    const root = allRules.find((r) => r.sheet === 'base.css' && r.selector.replace(/\s+/g, ' ') === 'html, body, #root')!;
    expect(root.decls.find((d) => d.prop === 'height')?.value).toBe('100vh');
    expect(root.decls.find((d) => d.prop === 'overflow')?.value).toBe('hidden');
  });
});

// ---------- page frame ----------
describe('page frame layout', () => {
  const val = (rule: { decls: { prop: string; value: string }[] }, prop: string) =>
    rule.decls.find((d) => d.prop === prop)?.value;
  const bySelector = (sel: string) => allRules.filter((r) => r.sheet === 'base.css' && r.selector === sel);

  it('makes #root a flex column', () => {
    const rules = bySelector('#root');
    expect(rules.some((r) => val(r, 'display') === 'flex' && val(r, 'flex-direction') === 'column')).toBe(true);
  });

  it('sizes .page by flex, not by 100vh', () => {
    const page = bySelector('.page')[0]!;
    expect(val(page, 'flex')).toBe('1 1 0');
    expect(val(page, 'min-height')).toBe('0');
    expect(val(page, 'height')).toBeUndefined();
  });

  it('uses 100vh only in the html, body, #root rule', () => {
    const bbCss = join(root, 'entrypoints', 'bloodbank', 'bloodbank.css');
    const rules = [
      ...allRules,
      ...parse(stripComments(readFileSync(bbCss, 'utf8'))).map((r) => ({ ...r, sheet: 'bloodbank.css' })),
    ];
    for (const rule of rules) {
      if (rule.decls.some((d) => /100vh/.test(d.value))) {
        expect(rule.selector.replace(/\s+/g, ' '), `${rule.sheet} ${rule.selector}`).toBe('html, body, #root');
      }
    }
  });
});

describe('Blood Bank stylesheet', () => {
  const rules = parse(stripComments(readFileSync(join(root, 'entrypoints', 'bloodbank', 'bloodbank.css'), 'utf8')));
  it('does not override html, body or #root', () => {
    for (const r of rules) expect(r.selector).not.toMatch(/(^|[\s,])(html|body|#root)(?![\w-])/);
  });
  it('scrolls inside .bb-scroll', () => {
    const scroll = rules.find((r) => r.selector === '.bb-scroll')!;
    expect(scroll.decls.find((d) => d.prop === 'overflow')?.value).toBe('auto');
    expect(scroll.decls.find((d) => d.prop === 'min-height')?.value).toBe('0');
  });
});

// ---------- theme blocks and colour literals ----------
const normalise = (v: string) => v.replace(/\s+/g, ' ').trim();
const tokenRules = sheets.find((s) => s.name === 'tokens.css')!.rules;
function themeBlock(id: string): Map<string, string> {
  const rules = tokenRules.filter((r) => r.selector.replace(/\s+/g, '') === `:root[data-theme='${id}']`);
  expect(rules, `one block for ${id}`).toHaveLength(1);
  return new Map(rules[0]!.decls.map((d) => [d.prop, normalise(d.value)]));
}

describe('Feature: themes, theme blocks in tokens.css (Requirement 6.1)', () => {
  it.each(THEME_IDS)('%s has one block with exactly the SURFACE_TOKENS names', (id) => {
    const block = themeBlock(id);
    expect([...block.keys()].sort()).toEqual(SURFACE_TOKENS.map((n) => `--${n}`).sort());
    expect(block.size).toBe(44);
  });
  it('every block has the same property set', () => {
    const sets = THEME_IDS.map((id) => [...themeBlock(id).keys()].sort().join(','));
    expect(new Set(sets).size).toBe(1);
  });
  it.each(THEME_IDS)('%s solid colours are #rrggbb', (id) => {
    const solid = ['sky-top', 'sky-bottom', 'ink', 'ink-dim', 'card-top', 'card-bottom', 'panel-solid', 'button-top', 'button-bottom', 'state-awake', 'state-starving', 'state-asleep', 'state-protected', 'badge-ink', 'quote-ink'];
    for (const n of solid) expect(themeBlock(id).get(`--${n}`), `--${n}`).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('the stylesheets hold the old Crypt literals only inside the Crypt block', () => {
    for (const rule of allRules) {
      if (rule.sheet === 'tokens.css') continue;
      for (const d of rule.decls) expect(d.value, `${rule.sheet} ${rule.selector}`).not.toMatch(/rgba\(1[02], ?[47], ?(16|20)|#ffb3c4/i);
    }
  });
});

describe('Feature: themes, no colour literals in component stylesheets (Requirement 6.2)', () => {
  const bbCss = join(root, 'entrypoints', 'bloodbank', 'bloodbank.css');
  const pickerCss = files(stylesDir, (n) => n === 'themePicker.css');
  const component = [
    ...sheets.filter((s) => s.name !== 'tokens.css').map((s) => ({ name: s.name, rules: s.rules })),
    { name: 'bloodbank.css', rules: parse(stripComments(readFileSync(bbCss, 'utf8'))) },
  ];
  const isBlackOrWhite = (lit: string): boolean => {
    const l = lit.toLowerCase();
    if (/^#(000|000000|fff|ffffff)([0-9a-f]{2})?$/.test(l)) return true;
    if (/^#(000|fff)[0-9a-f]?$/.test(l)) return true;
    const m = l.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return !!m && ((m[1] === '0' && m[2] === '0' && m[3] === '0') || (m[1] === '255' && m[2] === '255' && m[3] === '255'));
  };
  it('holds no colour other than black or white (with or without alpha)', () => {
    for (const sheet of component) {
      for (const rule of sheet.rules) {
        for (const d of rule.decls) {
          const value = d.value.replace(/url\([^)]*\)/g, '');
          for (const lit of value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? []) {
            expect(isBlackOrWhite(lit), `${sheet.name} ${rule.selector} ${d.prop}: ${lit}`).toBe(true);
          }
        }
      }
    }
  });
  it('includes bloodbank.css in the scan', () => {
    expect(component.map((c) => c.name)).toContain('bloodbank.css');
  });
  it('themePicker.css (when it exists) uses tokens only', () => {
    for (const path of pickerCss) {
      for (const rule of parse(stripComments(readFileSync(path, 'utf8')))) {
        for (const d of rule.decls) expect(d.value, `${rule.selector} ${d.prop}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b|hsla?\(|rgba?\(/);
      }
    }
  });
  it('uses the theme tokens for the three former literals', () => {
    const text = ['cards.css', 'header.css'].map((n) => readFileSync(join(stylesDir, n), 'utf8')).join('') + readFileSync(bbCss, 'utf8');
    for (const t of ['--shade', '--popup-fill', '--quote-ink']) expect(text).toContain(`var(${t})`);
  });
});

describe('Feature: themes, Property 7: tokens.css block equals the theme data', () => {
  it.each(THEME_IDS)('%s block equals THEMES[id].surface', (id) => {
    const block = themeBlock(id);
    const surface = themeById(id).surface as Record<string, string>;
    expect(Object.fromEntries(block)).toEqual(Object.fromEntries(Object.entries(surface).map(([k, v]) => [k, normalise(v)])));
  });
});
