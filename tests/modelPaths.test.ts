import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODELS, modelFile, type ModelId } from '../lib/scene/layout';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('model addresses with the default base', () => {
  it('modelFile gives the same strings as the old hard-coded paths', () => {
    for (const id of Object.keys(MODELS) as ModelId[]) {
      const src = MODELS[id].source;
      const old = src === 'custom' ? '/models/coffin.glb' : src === 'quaternius' ? `/models/quaternius/${id}.glb` : `/models/kaykit/${id}.gltf`;
      expect(modelFile(id)).toBe(old);
    }
  });

  it('no source file under lib or entrypoints hard-codes a "/models/" string', () => {
    const bad = [...sources('lib'), ...sources('entrypoints')].filter((f) => /['"`]\/models\//.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
