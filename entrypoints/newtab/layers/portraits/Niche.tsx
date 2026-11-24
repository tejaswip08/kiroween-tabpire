import { useMemo } from 'react';
import { Color, Vector3 } from 'three';
import type { VampireState } from '../../../../lib/hunger';
import { themeById, type ThemeId } from '../../../../lib/themes';
import { FRAME } from '../../../../lib/vampire/rig';
import { useSceneTheme } from '../scene/themeColors';

/** The Crypt state colours (kept for reference; the niche reads the active theme through nicheTint). */
export const STATE_COLOR: Record<VampireState, string> = {
  awake: '#b9a5ff',
  starving: '#ff6b6b',
  asleep: '#6fb7e8',
  protected: '#f4d58a',
};

/** The tint of one state in one theme: that theme's state colour, so the niche matches the card rim. */
export function nicheTint(id: ThemeId, state: VampireState): string {
  return themeById(id).surface[`--state-${state}` as const];
}

export type Rgb = readonly [number, number, number];

/** The Crypt niche base colours (the shader's original literals). */
const CRYPT_LOW: Rgb = [0.13, 0.07, 0.17];
const CRYPT_HIGH: Rgb = [0.17, 0.095, 0.22];

function hexToSrgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The two dark base colours of the niche (low = bottom, high = top) for a theme.
 * The Crypt uses its original literals. Other themes take their --card-bottom (low) and --card-top (high),
 * read them as sRGB (the shader writes its colour straight to the screen, so the Crypt literals are about 0.7 of
 * the card's sRGB values), and multiply per channel by (Crypt literal / Crypt card colour in sRGB),
 * so each theme keeps the relationship the Crypt has. Results are clamped to 0..1.
 */
export function nicheBase(id: ThemeId): readonly [Rgb, Rgb] {
  if (id === 'crypt') return [CRYPT_LOW, CRYPT_HIGH];
  const crypt = themeById('crypt').surface;
  const s = themeById(id).surface;
  const map = (literal: Rgb, cryptHex: string, hex: string): Rgb => {
    const ref = hexToSrgb(cryptHex);
    const own = hexToSrgb(hex);
    return [clamp01(own[0] * (literal[0] / ref[0])), clamp01(own[1] * (literal[1] / ref[1])), clamp01(own[2] * (literal[2] / ref[2]))];
  };
  return [map(CRYPT_LOW, crypt['--card-bottom'], s['--card-bottom']), map(CRYPT_HIGH, crypt['--card-top'], s['--card-top'])];
}

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragment = /* glsl */ `
varying vec2 vUv; uniform vec3 uTint; uniform vec3 uLow; uniform vec3 uHigh;
void main() {
  // The same dark purple as the card around it, so the window blends into the card, with a soft glow
  // in the state colour behind the head and a faint brightening toward the rim of the arch.
  vec3 card = mix(uLow, uHigh, vUv.y);
  float g = smoothstep(0.7, 0.0, length((vUv - vec2(0.5, 0.62)) * vec2(1.7, 1.3)));
  float low = smoothstep(0.5, 0.0, vUv.y) * 0.5;
  vec3 col = card + uTint * (0.32 * g + 0.06 * low);
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * The portrait's own background, tinted by the state colour. It fills the whole view and
 * is the part the card hole shows around the vampire. It is drawn behind everything.
 */
export function Niche({ state }: { state: VampireState }) {
  const uniforms = useMemo(() => ({
    uTint: { value: new Color(STATE_COLOR.awake) },
    uLow: { value: new Vector3(...CRYPT_LOW) },
    uHigh: { value: new Vector3(...CRYPT_HIGH) },
  }), []);

  const { id } = useSceneTheme();
  const [low, high] = nicheBase(id);
  uniforms.uLow.value.set(low[0], low[1], low[2]);
  uniforms.uHigh.value.set(high[0], high[1], high[2]);
  uniforms.uTint.value.set(nicheTint(id, state));
  return (
    <mesh position={[0, FRAME.centreY, -1.0]} renderOrder={-10}>
      <planeGeometry args={[3.2, 2.4]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} depthWrite={false} fog={false} />
    </mesh>
  );
}
