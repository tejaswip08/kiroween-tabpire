// Loads a .glb in Node, with its textures taken out, so tests can read the real geometry
// (including meshopt-compressed models). Not used by the extension.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

(globalThis as { self?: unknown }).self ??= globalThis;

export async function loadGlbGeometry(file: string): Promise<GLTF> {
  const b = readFileSync(join(__dirname, '..', '..', 'public', 'models', file));
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.toString('utf8', 20, 20 + jsonLen));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    const p = m.pbrMetallicRoughness;
    if (p) {
      delete p.baseColorTexture;
      delete p.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.emissiveTexture;
    delete m.occlusionTexture;
  }
  const drop = (e: string) => e !== 'EXT_texture_webp' && e !== 'KHR_texture_transform';
  json.extensionsUsed = (json.extensionsUsed ?? []).filter(drop);
  json.extensionsRequired = (json.extensionsRequired ?? []).filter(drop);
  const jb = Buffer.from(JSON.stringify(json));
  const jb2 = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
  const out = Buffer.concat([b.subarray(0, 12), Buffer.alloc(8), jb2, b.subarray(20 + jsonLen)]);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jb2.length, 12);
  out.write('JSON', 16, 'ascii');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  return new Promise((res, rej) => loader.parse(ab, '', res, rej));
}
