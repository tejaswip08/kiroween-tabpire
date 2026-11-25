// Every custom shader string must compile in WebGL 2 (GLSL ES 3.00): no reserved word may be used as a name.
// A variable called `patch` broke the Frozen Cemetery pond shader, and with the idle preload it broke every theme.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Keywords and reserved words of GLSL ES 3.00 (section 3.8) that someone might pick as a name. */
export const GLSL_RESERVED = new Set([
  'attribute', 'const', 'uniform', 'varying', 'layout', 'centroid', 'flat', 'smooth', 'invariant', 'discard', 'return',
  'in', 'out', 'inout', 'struct', 'precision', 'lowp', 'mediump', 'highp', 'switch', 'case', 'default',
  // reserved for future use
  'patch', 'sample', 'subroutine', 'noperspective', 'common', 'partition', 'active', 'asm', 'class', 'union', 'enum',
  'typedef', 'template', 'this', 'resource', 'goto', 'inline', 'noinline', 'public', 'static', 'extern', 'external',
  'interface', 'long', 'short', 'double', 'half', 'fixed', 'unsigned', 'superp', 'input', 'output', 'filter', 'sizeof',
  'cast', 'namespace', 'using', 'buffer', 'shared', 'coherent', 'volatile', 'restrict', 'readonly', 'writeonly',
  'atomic_uint', 'precise', 'hvec2', 'hvec3', 'hvec4', 'dvec2', 'dvec3', 'dvec4', 'fvec2', 'fvec3', 'fvec4',
  'sampler3DRect', 'image1D', 'image2D', 'image3D', 'imageCube',
]);
const TYPES = String.raw`(?:float|int|uint|bool|[biu]?vec[234]|mat[234](?:x[234])?|sampler2D|samplerCube|sampler3D)`;
const QUALIFIED = String.raw`(?:uniform|varying|attribute|in|out|inout|flat|smooth|highp|mediump|lowp|const)\s+`;
/** Names declared in a shader: variables, parameters, function names, struct fields. */
export function declaredNames(glsl: string): string[] {
  const code = glsl.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  const decl = new RegExp(String.raw`(?:${QUALIFIED})*\b${TYPES}\s+([A-Za-z_]\w*)((?:\s*(?:\[[^\]]*\])?\s*(?:=[^;,)]*)?,\s*[A-Za-z_]\w*)*)`, 'g');
  for (const m of code.matchAll(decl)) {
    out.push(m[1]!);
    for (const more of (m[2] ?? '').matchAll(/,\s*([A-Za-z_]\w*)/g)) out.push(more[1]!);
  }
  return out;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
/** The template strings of a source file that look like GLSL. */
function shaderStrings(src: string): string[] {
  return [...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]!).filter((s) => /\bvoid\s+main\b|gl_Position|gl_FragColor|#include\s*<|\b(?:float|vec[234])\s+\w+\s*[=;]/.test(s));
}

describe('GLSL reserved words', () => {
  it('finds names in declarations', () => {
    expect(declaredNames('uniform float uTime; varying vec2 vUv; float patch = 1.0, sample; vec3 f(vec3 input) { return input; }')).toEqual(
      ['uTime', 'vUv', 'patch', 'sample', 'f', 'input'],
    );
  });
  it('no custom shader uses a GLSL ES 3.00 reserved word as a name', () => {
    const root = join(__dirname, '..');
    const bad: string[] = [];
    let shaders = 0;
    for (const file of [...files(join(root, 'entrypoints')), ...files(join(root, 'lib'))]) {
      for (const glsl of shaderStrings(readFileSync(file, 'utf8'))) {
        shaders++;
        for (const name of declaredNames(glsl)) if (GLSL_RESERVED.has(name)) bad.push(`${relative(root, file)}: ${name}`);
      }
    }
    expect(shaders).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });
});
