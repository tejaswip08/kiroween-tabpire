// Checks that every CSS @keyframes block only animates transform and opacity (the 60 fps rule in .kiro/steering/style.md).
// `animation-timing-function` is allowed inside a keyframe too: it changes no property.
//
//   node tools/check-css-animations.mjs              every .css file under entrypoints/ and demo/src/
//   node tools/check-css-animations.mjs a.css b.css  only these files
// Exits with 1 and lists each bad property when one is found. Used by the .kiro/hooks/css-animation-check.json hook.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const ALLOWED = new Set(['transform', 'opacity', 'animation-timing-function']);

function cssFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...cssFiles(path));
    else if (name.endsWith('.css')) out.push(path);
  }
  return out;
}

/** The body of each @keyframes block in a stylesheet, with its name and line. */
export function keyframeBlocks(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const out = [];
  const re = /@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(clean))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') depth--;
      i++;
    }
    out.push({ name: m[1], line: clean.slice(0, m.index).split('\n').length, body: clean.slice(re.lastIndex, i - 1) });
    re.lastIndex = i;
  }
  return out;
}

/** The properties a keyframes body sets that are not allowed. */
export function badProperties(body) {
  const bad = [];
  for (const step of body.matchAll(/\{([^{}]*)\}/g)) {
    for (const decl of step[1].split(';')) {
      const prop = decl.split(':')[0]?.trim().toLowerCase();
      if (prop && !ALLOWED.has(prop)) bad.push(prop);
    }
  }
  return [...new Set(bad)];
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2).filter((a) => a.endsWith('.css'));
  const files = args.length ? args : [...cssFiles(join(root, 'entrypoints')), ...cssFiles(join(root, 'demo', 'src'))];
  const problems = [];
  for (const file of files) {
    for (const k of keyframeBlocks(readFileSync(file, 'utf8'))) {
      for (const prop of badProperties(k.body)) problems.push(`${relative(root, file)}:${k.line} @keyframes ${k.name} animates "${prop}"`);
    }
  }
  if (problems.length) {
    console.error('CSS animations may only change transform and opacity:');
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`CSS animations OK (${files.length} files).`);
}
