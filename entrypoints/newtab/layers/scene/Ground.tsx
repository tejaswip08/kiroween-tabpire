import { useMemo } from 'react';
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three';
import { mulberry32 } from '../../../../lib/scene/rng';

const SIZE = 512;
/** One tile of dark earth with patches of dark grass, drawn with the 2D canvas. No file, no network. */
function makeGroundTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d')!;
  const rng = mulberry32(31);
  g.fillStyle = '#30283a';
  g.fillRect(0, 0, SIZE, SIZE);
  // Soft blobs of earth and grass, drawn again at the edges so the tile repeats without a seam.
  const blob = (x: number, y: number, r: number, color: string, alpha: number) => {
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grad.addColorStop(0, color.replace('A', String(alpha)));
        grad.addColorStop(1, color.replace('A', '0'));
        g.fillStyle = grad;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  };
  for (let i = 0; i < 70; i++) blob(rng() * SIZE, rng() * SIZE, 40 + rng() * 70, 'rgba(52,70,44,A)', 0.55);
  for (let i = 0; i < 80; i++) blob(rng() * SIZE, rng() * SIZE, 30 + rng() * 60, 'rgba(22,16,30,A)', 0.5);
  for (let i = 0; i < 60; i++) blob(rng() * SIZE, rng() * SIZE, 18 + rng() * 40, 'rgba(74,58,60,A)', 0.4);
  // Fine speckle: pebbles and blades.
  for (let i = 0; i < 2600; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const light = rng();
    g.fillStyle = light > 0.7 ? 'rgba(70,86,48,0.35)' : light > 0.4 ? 'rgba(8,6,6,0.5)' : 'rgba(60,52,44,0.3)';
    g.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 3);
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The ground: one large dark plane of earth and grass that runs on past the graveyard into the
 * fog, so no edge shows. It is dark on purpose, so it does not compete with the cards.
 */
export function Ground() {
  const map = useMemo(makeGroundTexture, []);
  const tint = useMemo(() => new Color('#b8a8c8'), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial map={map} color={tint} roughness={1} metalness={0} />
    </mesh>
  );
}
