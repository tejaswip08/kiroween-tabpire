// Theme data: pure, no browser API, no wxt/browser, no three. One record per theme.
import type { ModelId } from './scene/layout';
import { ACCENT, COLD, CRYPT_EXTRA, CRYPT_SHADER, WARM } from './scene/palette';

export const THEME_IDS = ['crypt', 'pumpkin', 'forest', 'frost', 'bloodmoon', 'castle'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'crypt';
export const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);

type Hex = `#${string}`;
/** Linear RGB, the numbers a shader uses. */
type Linear3 = readonly [number, number, number];

/** Every colour the 3D scene draws. */
export interface ScenePalette {
  skyTop: Hex; skyMid: Hex; skyHorizon: Hex; haze: Hex; fog: Hex; farSilhouette: Hex;
  groundBase: Hex; groundTint: Hex;
  hemiSky: Hex; hemiGround: Hex; rim: Hex; moonlight: Hex;
  moon: Hex;
  moonLight: Linear3; moonDark: Linear3;
  cloudBody: Linear3; cloudTint: Linear3; lowCloud: Hex;
  ghost: Hex; ember: Hex; candle: Hex; lantern: Hex; jack: Hex; door: Hex;
  mushroom: Hex; cauldron: Hex; wisp: Hex;
  weatherA: Hex; weatherB: Hex;
  /**
   * A two-tone sky (the Witch's Forest): a glow added on the left of the sky, one added on the right, and a rim light of the same
   * colour from each side. A theme that has them also gets no stars and no hot spot of moon glow. Missing for the other themes.
   */
  skyLeft?: Hex; skyRight?: Hex;
}

/** The 41 Crypt token names (file order) plus shade, popup-fill and quote-ink. */
export const SURFACE_TOKENS = [
  'sky-top',
  'sky-bottom',
  'sky-glow',
  'vignette',
  'ink',
  'ink-dim',
  'card-top',
  'card-bottom',
  'card-edge',
  'card-highlight',
  'panel-solid',
  'panel-fill-top',
  'panel-fill-bottom',
  'panel-fill-fallback',
  'button-top',
  'button-bottom',
  'accent',
  'accent-bright',
  'blood-top',
  'blood-bottom',
  'glass',
  'dawn-top',
  'dawn-bottom',
  'dawn-glow',
  'state-awake',
  'state-starving',
  'state-asleep',
  'state-protected',
  'badge-1',
  'badge-2',
  'badge-3',
  'badge-4',
  'badge-5',
  'badge-6',
  'badge-ink',
  'shadow-card-inset',
  'shadow-card-outer',
  'shadow-card',
  'shadow-panel',
  'shadow-button',
  'focus-ring',
  'shade',
  'popup-fill',
  'quote-ink',
] as const;
export type SurfaceTokens = Record<`--${(typeof SURFACE_TOKENS)[number]}`, string>;

export type WeatherKind = 'snow' | 'ash' | 'fireflies' | 'leaves' | 'embers';

/** Where an added prop may stand: the left or right side of the yard, or behind the fence. */
export type ZoneName = 'left' | 'right' | 'far';
/** Base props of these models are removed (never the owl and crow trees). */
export interface PropDrop { models: readonly ModelId[] }
/** Up to `max` base props of the `from` models are replaced by one of the `to` models, scaled to the old height. */
export interface PropSwap { from: readonly ModelId[]; to: readonly ModelId[]; max: number }
/** `count` extra props of one model, scaled between `scale[0]` and `scale[1]`, in one zone. `torch` adds a lit glow. */
export interface PropAdd { model: ModelId; count: number; scale: readonly [number, number]; zone: ZoneName; torch?: true }
/** The props of a theme, as ids only (the layout code turns them into placements). */
export interface ThemeProps {
  drop?: PropDrop;
  swaps?: PropSwap[];
  adds: PropAdd[];
  /** Models that must be present in the layout for the default seed. */
  required: readonly ModelId[];
}

export interface Theme {
  id: ThemeId;
  name: string;
  /** One line, plain words, for the panel. */
  description: string;
  scene: ScenePalette;
  surface: SurfaceTokens;
  props: ThemeProps;
  weather: WeatherKind | null;
}

const SCENE_CRYPT: ScenePalette = {
  skyTop: COLD.skyTop,
  fog: COLD.fog,
  hemiSky: COLD.hemisphereSky,
  hemiGround: COLD.hemisphereGround,
  rim: COLD.rim,
  candle: WARM.candle,
  lantern: WARM.lantern,
  jack: WARM.jackOLantern,
  ember: WARM.ember,
  door: WARM.cryptDoor,
  moon: ACCENT.moon,
  moonlight: ACCENT.moonlight,
  ...CRYPT_EXTRA,
  ...CRYPT_SHADER,
  weatherA: WARM.ember,
  weatherB: WARM.ember,
};

const SCENE_PUMPKIN: ScenePalette = {
  candle: WARM.candle, lantern: WARM.lantern, jack: WARM.jackOLantern, door: WARM.cryptDoor,
  skyTop: '#2a2466',
  skyMid: '#7a3f6e',
  skyHorizon: '#e0752a',
  haze: '#c9703a',
  fog: '#6b3a3e',
  farSilhouette: '#3a1e2c',
  groundBase: '#7d8a34',
  groundTint: '#f0e6b4',
  hemiSky: '#e6c8d8',
  hemiGround: '#6a4a22',
  rim: '#ffb070',
  moonlight: '#ffd9a0',
  moon: '#f2d98a',
  moonLight: [0.86, 0.66, 0.26],
  moonDark: [0.6, 0.4, 0.14],
  cloudBody: [0.08, 0.04, 0.02],
  cloudTint: [0.3, 0.1, 0.03],
  lowCloud: '#4a2410',
  ghost: '#ffd9a0',
  ember: '#ff7a1a',
  mushroom: '#ffb347',
  cauldron: '#ffc23d',
  wisp: '#ffb86b',
  weatherA: '#d8321a',
  weatherB: '#ff9a1f',
};

const SCENE_FOREST: ScenePalette = {
  // A red-orange fire lights the left and the upper sky; green mist fills the distance and the right.
  candle: '#ff9a3a', lantern: '#ff8a2a', jack: '#ff7a1a', door: '#ff7a1a',
  skyTop: '#2a0606',
  skyMid: '#9a2610',
  skyHorizon: '#2c5a38',
  haze: '#3f8f50',
  fog: '#22492f',
  farSilhouette: '#0d2a1c',
  groundBase: '#0b0908',
  groundTint: '#ffffff',
  hemiSky: '#5a2818',
  hemiGround: '#0e2418',
  rim: '#35e08a',
  moonlight: '#ff6a2a',
  moon: '#ff5a22',
  moonLight: [0.6, 0.12, 0.04],
  moonDark: [0.25, 0.05, 0.02],
  cloudBody: [0.02, 0.01, 0.01],
  cloudTint: [0.2, 0.05, 0.02],
  lowCloud: '#22492f',
  ghost: '#7dff6a',
  ember: '#ff7a2a',
  mushroom: '#6dff7a',
  cauldron: '#44ff7a',
  wisp: '#ffb86b',
  weatherA: '#d6ff7a',
  weatherB: '#7affc0',
  skyLeft: '#ff5a1c',
  skyRight: '#35e08a',
};

const SCENE_FROST: ScenePalette = {
  candle: WARM.candle, lantern: WARM.lantern, jack: WARM.jackOLantern, door: WARM.cryptDoor,
  skyTop: '#0a1a33',
  skyMid: '#1b3a66',
  skyHorizon: '#5a86b8',
  haze: '#8fb4d8',
  fog: '#3a5a80',
  farSilhouette: '#2a4468',
  groundBase: '#9fb4cc',
  groundTint: '#e8f2ff',
  hemiSky: '#bfe0ff',
  hemiGround: '#5a7fa8',
  rim: '#a8d4ff',
  moonlight: '#cfe6ff',
  moon: '#f2f8ff',
  moonLight: [0.82, 0.87, 0.93],
  moonDark: [0.5, 0.56, 0.64],
  cloudBody: [0.08, 0.1, 0.16],
  cloudTint: [0.2, 0.28, 0.4],
  lowCloud: '#4a6a90',
  ghost: '#d8f0ff',
  ember: '#ff8a3a',
  mushroom: CRYPT_EXTRA.mushroom,
  cauldron: CRYPT_EXTRA.cauldron,
  wisp: CRYPT_EXTRA.wisp,
  weatherA: '#f4f9ff',
  weatherB: '#bcd6f0',
};

const SCENE_BLOODMOON: ScenePalette = {
  candle: WARM.candle, lantern: WARM.lantern, jack: WARM.jackOLantern, door: WARM.cryptDoor,
  skyTop: '#1a0308',
  skyMid: '#4a0a1a',
  skyHorizon: '#a01428',
  haze: '#c02a38',
  fog: '#4a1020',
  farSilhouette: '#2a0812',
  groundBase: '#2a1418',
  groundTint: '#9a6a6a',
  hemiSky: '#ff8aa0',
  hemiGround: '#5a1428',
  rim: '#ff5a70',
  moonlight: '#ff7a8a',
  moon: '#ff1f3a',
  moonLight: [0.55, 0.03, 0.02],
  moonDark: [0.24, 0.012, 0.008],
  cloudBody: [0.07, 0.02, 0.03],
  cloudTint: [0.3, 0.04, 0.07],
  lowCloud: '#4a1222',
  ghost: '#ffc0c8',
  ember: '#ff5a1a',
  mushroom: CRYPT_EXTRA.mushroom,
  cauldron: '#ff2a1a',
  wisp: CRYPT_EXTRA.wisp,
  weatherA: '#a89aa0',
  weatherB: '#5c4a50',
};

const SCENE_CASTLE: ScenePalette = {
  candle: WARM.candle, lantern: WARM.lantern, jack: WARM.jackOLantern, door: WARM.cryptDoor,
  skyTop: '#0c101c',
  skyMid: '#1f2536',
  skyHorizon: '#444c62',
  haze: '#667088',
  fog: '#2a3140',
  farSilhouette: '#141824',
  groundBase: '#2a2a32',
  groundTint: '#a8a8b8',
  hemiSky: '#a8b4ff',
  hemiGround: '#383e56',
  rim: '#9aa8ff',
  moonlight: '#cdd4ff',
  moon: '#e8ecff',
  moonLight: [0.66, 0.68, 0.74],
  moonDark: [0.28, 0.3, 0.38],
  cloudBody: [0.045, 0.05, 0.075],
  cloudTint: [0.13, 0.15, 0.22],
  lowCloud: '#2c3244',
  ghost: '#c8d8ff',
  ember: '#ff8a2a',
  mushroom: CRYPT_EXTRA.mushroom,
  cauldron: CRYPT_EXTRA.cauldron,
  wisp: CRYPT_EXTRA.wisp,
  weatherA: WARM.ember,
  weatherB: WARM.candle,
};

const SURFACE_CRYPT: SurfaceTokens = {
  '--sky-top': '#0b0612',
  '--sky-bottom': '#26112e',
  '--sky-glow': 'rgba(214, 40, 63, 0.2)',
  '--vignette': 'rgba(0, 0, 0, 0.6)',
  '--ink': '#f6eaf0',
  '--ink-dim': '#c9b5c4',
  '--card-top': '#2e1a3b',
  '--card-bottom': '#1b0e26',
  '--card-edge': 'rgba(255, 255, 255, 0.16)',
  '--card-highlight': 'rgba(255, 255, 255, 0.1)',
  '--panel-solid': '#2a1636',
  '--panel-fill-top': 'rgba(70, 40, 88, 0.55)',
  '--panel-fill-bottom': 'rgba(34, 17, 46, 0.55)',
  '--panel-fill-fallback': 'rgba(34, 17, 46, 0.92)',
  '--button-top': '#3d2350',
  '--button-bottom': '#26122f',
  '--accent': '#d6283f',
  '--accent-bright': '#ff5d73',
  '--blood-top': '#ff4d63',
  '--blood-bottom': '#8f1020',
  '--glass': 'rgba(255, 255, 255, 0.12)',
  '--dawn-top': '#4b2a78',
  '--dawn-bottom': '#9c4a3a',
  '--dawn-glow': '#ffd36e',
  '--state-awake': '#b9a5ff',
  '--state-starving': '#ff6b6b',
  '--state-asleep': '#6fb7e8',
  '--state-protected': '#f4d58a',
  '--badge-1': '#c77dff',
  '--badge-2': '#ff8fab',
  '--badge-3': '#ffb86b',
  '--badge-4': '#7bdff2',
  '--badge-5': '#95e68a',
  '--badge-6': '#f7a8e0',
  '--badge-ink': '#1b0e26',
  '--shadow-card-inset': '0 1px 0 var(--card-highlight) inset, 0 -14px 24px rgba(0, 0, 0, 0.28) inset',
  '--shadow-card-outer': '0 2px 2px rgba(0, 0, 0, 0.35), 0 10px 18px rgba(0, 0, 0, 0.4), 0 22px 40px rgba(6, 2, 12, 0.5)',
  '--shadow-card': 'var(--shadow-card-inset), var(--shadow-card-outer)',
  '--shadow-panel': '0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 24px rgba(0, 0, 0, 0.4)',
  '--shadow-button': '0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 -3px 6px rgba(0, 0, 0, 0.3) inset, 0 3px 8px rgba(0, 0, 0, 0.45)',
  '--focus-ring': '#ffd9e0',
  '--shade': 'rgba(10, 4, 16, 0.6)',
  '--popup-fill': 'rgba(12, 7, 20, 0.96)',
  '--quote-ink': '#ffb3c4',
};

const SURFACE_PUMPKIN: SurfaceTokens = {
  '--sky-top': '#2a2466',
  '--sky-bottom': '#8a4a3a',
  '--sky-glow': 'rgba(224, 112, 26, 0.2)',
  '--vignette': 'rgba(0, 0, 0, 0.6)',
  '--ink': '#fcf0de',
  '--ink-dim': '#dcc4a6',
  '--card-top': '#3b2213',
  '--card-bottom': '#25140a',
  '--card-edge': 'rgba(255, 255, 255, 0.16)',
  '--card-highlight': 'rgba(255, 255, 255, 0.1)',
  '--panel-solid': '#34200f',
  '--panel-fill-top': 'rgba(76, 59, 44, 0.55)',
  '--panel-fill-bottom': 'rgba(37, 20, 10, 0.55)',
  '--panel-fill-fallback': 'rgba(37, 20, 10, 0.92)',
  '--button-top': '#4f2d17',
  '--button-bottom': '#2f180b',
  '--accent': '#e0701a',
  '--accent-bright': '#ff9a45',
  '--blood-top': '#ff4d63',
  '--blood-bottom': '#8f1020',
  '--glass': 'rgba(255, 255, 255, 0.12)',
  '--dawn-top': '#5a3418',
  '--dawn-bottom': '#a8501e',
  '--dawn-glow': '#ffd36e',
  '--state-awake': '#c4b0ff',
  '--state-starving': '#ff7468',
  '--state-asleep': '#74bdea',
  '--state-protected': '#f6d98a',
  '--badge-1': '#c77dff',
  '--badge-2': '#ff8fab',
  '--badge-3': '#ffb86b',
  '--badge-4': '#7bdff2',
  '--badge-5': '#95e68a',
  '--badge-6': '#f7a8e0',
  '--badge-ink': '#1b0e26',
  '--shadow-card-inset': '0 1px 0 var(--card-highlight) inset, 0 -14px 24px rgba(0, 0, 0, 0.28) inset',
  '--shadow-card-outer': '0 2px 2px rgba(0, 0, 0, 0.35), 0 10px 18px rgba(0, 0, 0, 0.4), 0 22px 40px rgba(6, 2, 12, 0.5)',
  '--shadow-card': 'var(--shadow-card-inset), var(--shadow-card-outer)',
  '--shadow-panel': '0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 24px rgba(0, 0, 0, 0.4)',
  '--shadow-button': '0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 -3px 6px rgba(0, 0, 0, 0.3) inset, 0 3px 8px rgba(0, 0, 0, 0.45)',
  '--focus-ring': '#ffe2b8',
  '--shade': 'rgba(26, 12, 5, 0.6)',
  '--popup-fill': 'rgba(26, 12, 5, 0.96)',
  '--quote-ink': '#ffc58a',
};

const SURFACE_FOREST: SurfaceTokens = {
  '--sky-top': '#2a0808',
  '--sky-bottom': '#1f4530',
  '--sky-glow': 'rgba(255, 90, 28, 0.22)',
  '--vignette': 'rgba(0, 0, 0, 0.6)',
  '--ink': '#e9f7ef',
  '--ink-dim': '#b4d0c2',
  '--card-top': '#1b3a31',
  '--card-bottom': '#0f241e',
  '--card-edge': 'rgba(255, 255, 255, 0.16)',
  '--card-highlight': 'rgba(255, 255, 255, 0.1)',
  '--panel-solid': '#183229',
  '--panel-fill-top': 'rgba(52, 75, 67, 0.55)',
  '--panel-fill-bottom': 'rgba(15, 36, 30, 0.55)',
  '--panel-fill-fallback': 'rgba(15, 36, 30, 0.92)',
  '--button-top': '#244a3f',
  '--button-bottom': '#12302a',
  '--accent': '#1fb87a',
  '--accent-bright': '#5cf0b0',
  '--blood-top': '#ff4d63',
  '--blood-bottom': '#8f1020',
  '--glass': 'rgba(255, 255, 255, 0.12)',
  '--dawn-top': '#1f4a3c',
  '--dawn-bottom': '#56762f',
  '--dawn-glow': '#ffd36e',
  '--state-awake': '#b5aaff',
  '--state-starving': '#ff7272',
  '--state-asleep': '#6cc0e6',
  '--state-protected': '#f0da8c',
  '--badge-1': '#c77dff',
  '--badge-2': '#ff8fab',
  '--badge-3': '#ffb86b',
  '--badge-4': '#7bdff2',
  '--badge-5': '#95e68a',
  '--badge-6': '#f7a8e0',
  '--badge-ink': '#1b0e26',
  '--shadow-card-inset': '0 1px 0 var(--card-highlight) inset, 0 -14px 24px rgba(0, 0, 0, 0.28) inset',
  '--shadow-card-outer': '0 2px 2px rgba(0, 0, 0, 0.35), 0 10px 18px rgba(0, 0, 0, 0.4), 0 22px 40px rgba(6, 2, 12, 0.5)',
  '--shadow-card': 'var(--shadow-card-inset), var(--shadow-card-outer)',
  '--shadow-panel': '0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 24px rgba(0, 0, 0, 0.4)',
  '--shadow-button': '0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 -3px 6px rgba(0, 0, 0, 0.3) inset, 0 3px 8px rgba(0, 0, 0, 0.45)',
  '--focus-ring': '#d2ffe8',
  '--shade': 'rgba(4, 16, 12, 0.6)',
  '--popup-fill': 'rgba(4, 16, 12, 0.96)',
  '--quote-ink': '#9af5c8',
};

const SURFACE_FROST: SurfaceTokens = {
  '--sky-top': '#08111f',
  '--sky-bottom': '#2b4a6b',
  '--sky-glow': 'rgba(61, 143, 224, 0.2)',
  '--vignette': 'rgba(0, 0, 0, 0.6)',
  '--ink': '#f0f7ff',
  '--ink-dim': '#bfd2e6',
  '--card-top': '#213a52',
  '--card-bottom': '#132231',
  '--card-edge': 'rgba(255, 255, 255, 0.16)',
  '--card-highlight': 'rgba(255, 255, 255, 0.1)',
  '--panel-solid': '#1f3750',
  '--panel-fill-top': 'rgba(58, 79, 101, 0.55)',
  '--panel-fill-bottom': 'rgba(19, 34, 49, 0.55)',
  '--panel-fill-fallback': 'rgba(19, 34, 49, 0.92)',
  '--button-top': '#2d4d6b',
  '--button-bottom': '#193046',
  '--accent': '#3d8fe0',
  '--accent-bright': '#7cc0ff',
  '--blood-top': '#ff4d63',
  '--blood-bottom': '#8f1020',
  '--glass': 'rgba(255, 255, 255, 0.12)',
  '--dawn-top': '#2d4d78',
  '--dawn-bottom': '#5e6e94',
  '--dawn-glow': '#ffd36e',
  '--state-awake': '#bcb4ff',
  '--state-starving': '#ff8282',
  '--state-asleep': '#7cc4f2',
  '--state-protected': '#f2dc92',
  '--badge-1': '#c77dff',
  '--badge-2': '#ff8fab',
  '--badge-3': '#ffb86b',
  '--badge-4': '#7bdff2',
  '--badge-5': '#95e68a',
  '--badge-6': '#f7a8e0',
  '--badge-ink': '#1b0e26',
  '--shadow-card-inset': '0 1px 0 var(--card-highlight) inset, 0 -14px 24px rgba(0, 0, 0, 0.28) inset',
  '--shadow-card-outer': '0 2px 2px rgba(0, 0, 0, 0.35), 0 10px 18px rgba(0, 0, 0, 0.4), 0 22px 40px rgba(6, 2, 12, 0.5)',
  '--shadow-card': 'var(--shadow-card-inset), var(--shadow-card-outer)',
  '--shadow-panel': '0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 24px rgba(0, 0, 0, 0.4)',
  '--shadow-button': '0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 -3px 6px rgba(0, 0, 0, 0.3) inset, 0 3px 8px rgba(0, 0, 0, 0.45)',
  '--focus-ring': '#dff0ff',
  '--shade': 'rgba(8, 17, 31, 0.6)',
  '--popup-fill': 'rgba(8, 17, 31, 0.96)',
  '--quote-ink': '#a8d4ff',
};

const SURFACE_BLOODMOON: SurfaceTokens = {
  '--sky-top': '#120208',
  '--sky-bottom': '#42091a',
  '--sky-glow': 'rgba(224, 16, 48, 0.2)',
  '--vignette': 'rgba(0, 0, 0, 0.6)',
  '--ink': '#fcebee',
  '--ink-dim': '#dcb3bb',
  '--card-top': '#3c1022',
  '--card-bottom': '#250813',
  '--card-edge': 'rgba(255, 255, 255, 0.16)',
  '--card-highlight': 'rgba(255, 255, 255, 0.1)',
  '--panel-solid': '#341020',
  '--panel-fill-top': 'rgba(76, 45, 59, 0.55)',
  '--panel-fill-bottom': 'rgba(37, 8, 19, 0.55)',
  '--panel-fill-fallback': 'rgba(37, 8, 19, 0.92)',
  '--button-top': '#51172c',
  '--button-bottom': '#300c19',
  '--accent': '#e01030',
  '--accent-bright': '#ff4a5e',
  '--blood-top': '#ff4d63',
  '--blood-bottom': '#8f1020',
  '--glass': 'rgba(255, 255, 255, 0.12)',
  '--dawn-top': '#51172c',
  '--dawn-bottom': '#a8321e',
  '--dawn-glow': '#ffd36e',
  '--state-awake': '#c2adff',
  '--state-starving': '#ff7a7a',
  '--state-asleep': '#74b9e6',
  '--state-protected': '#f3d58a',
  '--badge-1': '#c77dff',
  '--badge-2': '#ff8fab',
  '--badge-3': '#ffb86b',
  '--badge-4': '#7bdff2',
  '--badge-5': '#95e68a',
  '--badge-6': '#f7a8e0',
  '--badge-ink': '#1b0e26',
  '--shadow-card-inset': '0 1px 0 var(--card-highlight) inset, 0 -14px 24px rgba(0, 0, 0, 0.28) inset',
  '--shadow-card-outer': '0 2px 2px rgba(0, 0, 0, 0.35), 0 10px 18px rgba(0, 0, 0, 0.4), 0 22px 40px rgba(6, 2, 12, 0.5)',
  '--shadow-card': 'var(--shadow-card-inset), var(--shadow-card-outer)',
  '--shadow-panel': '0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 24px rgba(0, 0, 0, 0.4)',
  '--shadow-button': '0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 -3px 6px rgba(0, 0, 0, 0.3) inset, 0 3px 8px rgba(0, 0, 0, 0.45)',
  '--focus-ring': '#ffd0d8',
  '--shade': 'rgba(18, 2, 8, 0.6)',
  '--popup-fill': 'rgba(18, 2, 8, 0.96)',
  '--quote-ink': '#ff9aa8',
};

const SURFACE_CASTLE: SurfaceTokens = {
  '--sky-top': '#0c0e16',
  '--sky-bottom': '#2c3040',
  '--sky-glow': 'rgba(122, 106, 224, 0.2)',
  '--vignette': 'rgba(0, 0, 0, 0.6)',
  '--ink': '#f3f1ea',
  '--ink-dim': '#c6c4b8',
  '--card-top': '#2f3445',
  '--card-bottom': '#1d2130',
  '--card-edge': 'rgba(255, 255, 255, 0.16)',
  '--card-highlight': 'rgba(255, 255, 255, 0.1)',
  '--panel-solid': '#2a2f40',
  '--panel-fill-top': 'rgba(68, 72, 87, 0.55)',
  '--panel-fill-bottom': 'rgba(29, 33, 48, 0.55)',
  '--panel-fill-fallback': 'rgba(29, 33, 48, 0.92)',
  '--button-top': '#3d4357',
  '--button-bottom': '#262a3a',
  '--accent': '#7a6ae0',
  '--accent-bright': '#a898ff',
  '--blood-top': '#ff4d63',
  '--blood-bottom': '#8f1020',
  '--glass': 'rgba(255, 255, 255, 0.12)',
  '--dawn-top': '#3d4357',
  '--dawn-bottom': '#7a5c3e',
  '--dawn-glow': '#ffd36e',
  '--state-awake': '#bcaeff',
  '--state-starving': '#ff7070',
  '--state-asleep': '#72b8e6',
  '--state-protected': '#f2d27c',
  '--badge-1': '#c77dff',
  '--badge-2': '#ff8fab',
  '--badge-3': '#ffb86b',
  '--badge-4': '#7bdff2',
  '--badge-5': '#95e68a',
  '--badge-6': '#f7a8e0',
  '--badge-ink': '#1b0e26',
  '--shadow-card-inset': '0 1px 0 var(--card-highlight) inset, 0 -14px 24px rgba(0, 0, 0, 0.28) inset',
  '--shadow-card-outer': '0 2px 2px rgba(0, 0, 0, 0.35), 0 10px 18px rgba(0, 0, 0, 0.4), 0 22px 40px rgba(6, 2, 12, 0.5)',
  '--shadow-card': 'var(--shadow-card-inset), var(--shadow-card-outer)',
  '--shadow-panel': '0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 24px rgba(0, 0, 0, 0.4)',
  '--shadow-button': '0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 -3px 6px rgba(0, 0, 0, 0.3) inset, 0 3px 8px rgba(0, 0, 0, 0.45)',
  '--focus-ring': '#e4e0ff',
  '--shade': 'rgba(12, 14, 22, 0.6)',
  '--popup-fill': 'rgba(12, 14, 22, 0.96)',
  '--quote-ink': '#c4baff',
};

/** The Crypt adds nothing: its layout is the base layout. */
const PROPS_CRYPT: ThemeProps = { adds: [], required: [] };
const PROPS_PUMPKIN: ThemeProps = {
  adds: [
    { model: 'farm_barn', count: 1, scale: [0.9, 1], zone: 'far' },
    { model: 'farm_silo', count: 1, scale: [1, 1.1], zone: 'far' },
    { model: 'farm_fence', count: 3, scale: [1, 1], zone: 'far' },
    { model: 'farm_corn', count: 8, scale: [1.2, 1.6], zone: 'left' },
    { model: 'farm_pumpkin', count: 6, scale: [1, 1.4], zone: 'right' },
  ],
  required: ['farm_barn', 'farm_silo', 'farm_corn', 'farm_pumpkin', 'farm_fence'],
};
const PROPS_FOREST: ThemeProps = {
  // The Witch's Forest is a scene of its own (lib/scene/uniqueScenes/forest.ts); this table names the models it uses.
  adds: [
    { model: 'forest_twisted_a', count: 1, scale: [1.3, 1.5], zone: 'left' },
    { model: 'forest_twisted_b', count: 1, scale: [1.3, 1.3], zone: 'left' },
    { model: 'forest_twisted_c', count: 1, scale: [1.2, 1.3], zone: 'right' },
    { model: 'forest_cauldron', count: 1, scale: [6, 7], zone: 'right' },
    { model: 'forest_mushroom', count: 4, scale: [0.9, 1.3], zone: 'right' },
    { model: 'pumpkin_orange_jackolantern', count: 1, scale: [1.5, 1.5], zone: 'left' },
  ],
  required: ['forest_twisted_a', 'forest_twisted_b', 'forest_twisted_c', 'forest_cauldron', 'forest_mushroom', 'pumpkin_orange_jackolantern'],
};
const PROPS_FROST: ThemeProps = {
  drop: { models: ['tree_dead_large_decorated'] },
  swaps: [{ from: ['tree_dead_large', 'tree_dead_medium', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium'], to: ['frost_pine_a', 'frost_pine_b'], max: 2 }],
  adds: [
    { model: 'frost_pine_a', count: 1, scale: [0.5, 0.7], zone: 'far' },
    { model: 'frost_pine_b', count: 1, scale: [0.6, 0.8], zone: 'far' },
    { model: 'frost_pines', count: 1, scale: [2, 3], zone: 'left' },
    { model: 'frost_rock', count: 3, scale: [1, 1.5], zone: 'right' },
  ],
  required: ['frost_pine_a', 'frost_pine_b', 'frost_pines', 'frost_rock'],
};
const PROPS_BLOODMOON: ThemeProps = {
  adds: [
    { model: 'blood_ruins', count: 1, scale: [0.3, 0.35], zone: 'far' },
    { model: 'blood_column', count: 4, scale: [1, 1.3], zone: 'far' },
    { model: 'blood_column_round', count: 3, scale: [1.2, 1.8], zone: 'left' },
    { model: 'blood_pedestal', count: 2, scale: [1, 1.3], zone: 'right' },
  ],
  required: ['blood_ruins', 'blood_column', 'blood_column_round', 'blood_pedestal'],
};
const PROPS_CASTLE: ThemeProps = {
  adds: [
    { model: 'castle_fortress', count: 1, scale: [3.5, 4], zone: 'far' },
    { model: 'castle_wall_towers', count: 2, scale: [4, 5], zone: 'far' },
    { model: 'castle_stone_wall', count: 2, scale: [3, 3], zone: 'far' },
    { model: 'castle_torch', count: 4, scale: [1.4, 1.8], zone: 'left', torch: true },
    { model: 'castle_banner', count: 1, scale: [1.2, 1.5], zone: 'right' },
  ],
  required: ['castle_fortress', 'castle_wall_towers', 'castle_torch', 'castle_banner', 'castle_stone_wall'],
};

export const THEMES: readonly Theme[] = [
  { id: 'crypt', name: 'The Crypt', description: 'Purple night, a red moon and a quiet graveyard.', scene: SCENE_CRYPT, surface: SURFACE_CRYPT, props: PROPS_CRYPT, weather: null },
  { id: 'pumpkin', name: 'Pumpkin Patch', description: 'Orange dusk with a barn, corn and pumpkins.', scene: SCENE_PUMPKIN, surface: SURFACE_PUMPKIN, props: PROPS_PUMPKIN, weather: 'leaves' },
  { id: 'forest', name: "Witch's Forest", description: 'Green mist, twisted trees and a bubbling cauldron.', scene: SCENE_FOREST, surface: SURFACE_FOREST, props: PROPS_FOREST, weather: 'fireflies' },
  { id: 'frost', name: 'Frozen Cemetery', description: 'Cold blue night with frosted pines and falling snow.', scene: SCENE_FROST, surface: SURFACE_FROST, props: PROPS_FROST, weather: 'snow' },
  { id: 'bloodmoon', name: 'Blood Moon', description: 'A deep red sky over old ruins and drifting ash.', scene: SCENE_BLOODMOON, surface: SURFACE_BLOODMOON, props: PROPS_BLOODMOON, weather: 'ash' },
  { id: 'castle', name: 'Haunted Castle', description: 'Grey towers, banners and torches under pale light.', scene: SCENE_CASTLE, surface: SURFACE_CASTLE, props: PROPS_CASTLE, weather: 'embers' },
];

/** Never undefined. Unknown ids give the Crypt. */
export const themeById = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]!;
