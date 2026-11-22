import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const DIRS = ['lib/scene', 'lib/vampire', 'entrypoints/newtab/layers'];

function walk(dir: string): string[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  const out: string[] = [];
  for (const name of readdirSync(full)) {
    const p = join(full, name);
    if (statSync(p).isDirectory()) out.push(...walk(join(dir, name)));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Source without comments, so notes about web addresses do not count. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

export const findHosts = (src: string): string[] => src.match(/(?:https?:)?\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/gi) ?? [];
export const usesEnvironment = (src: string): boolean => /\bEnvironment\b/.test(src);
export const usesDreiText = (src: string): boolean =>
  /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*['"]@react-three\/drei['"]/.test(src) || /<Text\b/.test(src);
export const usesFetch = (src: string): boolean => /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|importScripts/.test(src);
/** Every useGLTF call (and preload) must pass `false` as the second argument (no Draco). */
export function gltfCallsWithDraco(src: string): string[] {
  const bad: string[] = [];
  const re = /useGLTF(?:\.preload)?\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
  for (const m of src.matchAll(re)) {
    const args = splitArgs(m[1] ?? '');
    if (args[1]?.trim() !== 'false') bad.push(m[0]);
  }
  return bad;
}
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

describe('the checks themselves', () => {
  it('find what they should', () => {
    expect(findHosts('const u = "https://cdn.example.com/a.glb"')).toHaveLength(1);
    expect(findHosts('"//fonts.example.org/x"')).toHaveLength(1);
    expect(findHosts("mask: url('data:image/svg+xml;utf8,%3Csvg%20xmlns...')")).toHaveLength(0);
    expect(findHosts(stripComments('// see https://threejs.org\nconst a = 1;'))).toHaveLength(0);
    expect(usesEnvironment('<Environment preset="city" />')).toBe(true);
    expect(usesDreiText("import { Text } from '@react-three/drei'")).toBe(true);
    expect(usesDreiText("import { View } from '@react-three/drei'")).toBe(false);
    expect(usesFetch('await fetch(url)')).toBe(true);
    expect(gltfCallsWithDraco("useGLTF('/a.glb')")).toHaveLength(1);
    expect(gltfCallsWithDraco("useGLTF('/a.glb', true)")).toHaveLength(1);
    expect(gltfCallsWithDraco("useGLTF(url('/a.glb'), false, true)")).toHaveLength(0);
    expect(gltfCallsWithDraco("useGLTF.preload('/a.glb', false)")).toHaveLength(0);
  });
});

describe('3D code stays local', () => {
  const files = DIRS.flatMap(walk);
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });
  it('names no web address with a host', () => {
    for (const f of files) expect(findHosts(stripComments(readFileSync(f, 'utf8'))), f).toEqual([]);
  });
  it('uses no Environment preset and no drei Text', () => {
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'));
      expect(usesEnvironment(src), f).toBe(false);
      expect(usesDreiText(src), f).toBe(false);
    }
  });
  it('makes no network call', () => {
    for (const f of files) expect(usesFetch(stripComments(readFileSync(f, 'utf8'))), f).toBe(false);
  });
  it('sets Draco off in every useGLTF', () => {
    for (const f of files) expect(gltfCallsWithDraco(stripComments(readFileSync(f, 'utf8'))), f).toEqual([]);
  });
});
