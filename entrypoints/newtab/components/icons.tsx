// Custom gradient SVG icons. No icon library.
// Every gradient id comes from useId, so icons can repeat on the page.
import { useId, type ReactNode } from 'react';
import type { VampireState } from '../../../lib/hunger';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 24,
  className,
  viewBox = '0 0 32 32',
  children,
  width,
  height,
}: IconProps & { viewBox?: string; children: ReactNode; width?: number; height?: number }) {
  return (
    <svg
      className={className}
      width={width ?? size}
      height={height ?? size}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Grad({ id, from, to, vertical = true }: { id: string; from: string; to: string; vertical?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 0}>
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

/** Stake: a wooden stake with a sharp tip and a drop of blood. */
export function StakeIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}w`} from="#f6cf9a" to="#9a6030" vertical={false} />
      </defs>
      <g transform="rotate(35 16 16)">
        <path d="M11.500 1.500h9l1 4v13.500L16 31 10.500 19V5.500z" fill={`url(#${id}w)`} stroke="#4a2a12" strokeWidth="1.200" strokeLinejoin="round" />
        <path d="M13.500 5v14M18.500 6l.5 11" stroke="#7a4a22" strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
        <path d="M12 4v12" stroke="#fff0d0" strokeWidth="1.200" strokeLinecap="round" opacity="0.7" />
        <path d="M12.300 25.500L16 31l3.700-5.500z" fill="#8f1020" />
      </g>
    </Svg>
  );
}

/** Coffin: a six-sided coffin with a lid. */
export function CoffinIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}c`} from="#a8714f" to="#4a2618" vertical={false} />
        <Grad id={`${id}l`} from="#c79170" to="#7a4630" />
      </defs>
      <path d="M12 2.5h8l5 8.5-4.2 17.5h-9.6L7 11z" fill={`url(#${id}c)`} stroke="#2b140b" strokeWidth="1" strokeLinejoin="round" />
      <path d="M13.2 5h5.6l3.4 6-3 14h-6.4l-3-14z" fill={`url(#${id}l)`} opacity="0.85" />
      <path d="M16 9.5l2 2.4-2 2.4-2-2.4z" fill="#ffd36e" stroke="#8a5a10" strokeWidth="0.6" />
      <path d="M12.6 5.2h3" stroke="#fff0e0" strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
    </Svg>
  );
}

/** Crypt: a small stone crypt with a pointed roof, two pillars and an arched door. */
export function CryptIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}roof`} from="#d9d1f2" to="#8a7fb8" />
        <Grad id={`${id}wall`} from="#c4bbe6" to="#6f6598" />
        <Grad id={`${id}door`} from="#0e0616" to="#3a2150" />
      </defs>
      {/* steps */}
      <path d="M3 28.500h26v3H3z" fill="#5a5080" stroke="#2a2246" strokeWidth="0.8" strokeLinejoin="round" />
      {/* walls */}
      <path d="M5.500 13.500h21v15h-21z" fill={`url(#${id}wall)`} stroke="#2a2246" strokeWidth="1" strokeLinejoin="round" />
      {/* roof */}
      <path d="M2.500 14L16 3.500 29.500 14z" fill={`url(#${id}roof)`} stroke="#2a2246" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="16" cy="10" r="1.800" fill="#2a1840" stroke="#2a2246" strokeWidth="0.6" />
      {/* pillars */}
      <path d="M7 14.500v14M25 14.500v14" stroke="#efeaff" strokeWidth="1.600" strokeLinecap="round" opacity="0.65" />
      {/* arched door */}
      <path d="M11.500 28.500v-8a4.500 4.500 0 0 1 9 0v8z" fill={`url(#${id}door)`} stroke="#2a2246" strokeWidth="0.9" strokeLinejoin="round" />
      <circle cx="18.600" cy="24.500" r="0.8" fill="#ffd36e" />
      {/* light on the roof edge */}
      <path d="M5 12.500L15 5" stroke="#fff" strokeWidth="1.100" strokeLinecap="round" opacity="0.7" />
    </Svg>
  );
}

/** Garlic: a garlic bulb. */
export function GarlicIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}g`} from="#fffaf0" to="#dcc990" />
      </defs>
      <path d="M16 2.5c.4 2.2 1 4.3 1.6 6.3 5 1.1 8.4 5.1 8.4 10 0 5.6-4.2 9.2-10 9.2s-10-3.6-10-9.2c0-4.9 3.4-8.9 8.4-10C15 6.800 15.600 4.700 16 2.500z" fill={`url(#${id}g)`} stroke="#8f7a3e" strokeWidth="1" strokeLinejoin="round" />
      <path d="M16 9c-3 3-4 8-3 17M16 9c3 3 4 8 3 17M16 9v18" stroke="#b79d5a" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <path d="M13.800 29.600l-.8 1.600M16 29.800v1.800M18.200 29.600l.8 1.600" stroke="#8f7a3e" strokeWidth="1" strokeLinecap="round" />
      <path d="M10.500 14.500c.4-1.600 1.400-2.800 2.800-3.500" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" fill="none" />
    </Svg>
  );
}

/** Wake: an open eye with a warm iris, rising out of the coffin's sleep. */
export function WakeIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}w`} from="#fff3c4" to="#f2a65a" />
        <Grad id={`${id}i`} from="#ff8fab" to="#b0244a" />
      </defs>
      <path d="M3 17c3.600-6 8-9 13-9s9.400 3 13 9c-3.600 6-8 9-13 9S6.600 23 3 17z" fill={`url(#${id}w)`} stroke="#5a2a1a" strokeWidth="1.200" strokeLinejoin="round" />
      <circle cx="16" cy="17" r="5.200" fill={`url(#${id}i)`} stroke="#5a1a2a" strokeWidth="1" />
      <circle cx="16" cy="17" r="2" fill="#2a0a12" />
      <circle cx="14.200" cy="15.200" r="1.100" fill="#fff" />
      <path d="M16 2.500v3M7.500 5.500l1.800 2.400M24.500 5.500l-1.800 2.400" stroke="#ffd36e" strokeWidth="1.600" strokeLinecap="round" />
    </Svg>
  );
}
/** Remove garlic: the bulb with a slash. */
export function RemoveGarlicIcon(props: IconProps) {
  return (
    <span className="icon-stack" aria-hidden="true">
      <GarlicIcon {...props} />
      <Svg {...props} className="icon-slash">
        <path d="M5 27L27 5" stroke="#2a0a12" strokeWidth="5" strokeLinecap="round" />
        <path d="M5 27L27 5" stroke="#ff5d73" strokeWidth="2.600" strokeLinecap="round" />
      </Svg>
    </span>
  );
}

/** Themes: a crescent moon with sparkles. */
export function ThemesIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}m`} from="#e6d4ff" to="#8a63d2" vertical={false} />
      </defs>
      <path d="M22.500 4.500a12 12 0 1 0 5 19.500A10 10 0 0 1 22.500 4.500z" fill={`url(#${id}m)`} stroke="#4a2f7e" strokeWidth="1" strokeLinejoin="round" />
      <path d="M26 6v4M24 8h4" stroke="#ffe08a" strokeWidth="1.600" strokeLinecap="round" />
      <path d="M29 14v2.500M27.750 15.250h2.500" stroke="#ffe08a" strokeWidth="1.200" strokeLinecap="round" />
    </Svg>
  );
}

/** Blood Bank: a glossy blood orb. */
export function BloodOrbIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <radialGradient id={`${id}o`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#ff9fae" />
          <stop offset="0.35" stopColor="#e8334a" />
          <stop offset="1" stopColor="#5a0a16" />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="29" rx="8" ry="1.800" fill="#000" opacity="0.35" />
      <circle cx="16" cy="16" r="12" fill={`url(#${id}o)`} stroke="#3d0610" strokeWidth="1" />
      <ellipse cx="11.800" cy="10.500" rx="4" ry="2.400" transform="rotate(-30 11.800 10.500)" fill="#fff" opacity="0.7" />
      <path d="M21 24c2-1 3.500-3 4-5.500" stroke="#ff8a9a" strokeWidth="1.200" strokeLinecap="round" fill="none" opacity="0.6" />
    </Svg>
  );
}

/** Dawn: a sun rising over a horizon. */
export function DawnIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}s`} from="#ffe58a" to="#f2894a" />
        <Grad id={`${id}h`} from="#9a6bd6" to="#4b2a78" />
      </defs>
      <path d="M7 22a9 9 0 0 1 18 0z" fill={`url(#${id}s)`} stroke="#a64a1c" strokeWidth="1" strokeLinejoin="round" />
      <path d="M16 4.500v4M6.200 9.200l2.800 2.800M25.800 9.200L23 12M2.500 17.500h4M25.500 17.500h4" stroke="#ffd36e" strokeWidth="2" strokeLinecap="round" />
      <path d="M2.500 24.500h27" stroke={`url(#${id}h)`} strokeWidth="2.600" strokeLinecap="round" />
      <path d="M8 28.500h16" stroke="#9a6bd6" strokeWidth="1.600" strokeLinecap="round" opacity="0.7" />
    </Svg>
  );
}

/** Search: a magnifier. */
export function SearchIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}s`} from="#ffd9e0" to="#c9a4ff" />
      </defs>
      <circle cx="13" cy="13" r="8" fill="none" stroke={`url(#${id}s)`} strokeWidth="3" />
      <path d="M19 19l8 8" stroke={`url(#${id}s)`} strokeWidth="3.600" strokeLinecap="round" />
      <path d="M9 10.500a5 5 0 0 1 3-2.500" stroke="#fff" strokeWidth="1.400" strokeLinecap="round" fill="none" opacity="0.7" />
    </Svg>
  );
}

/** Plus sign for "Add page". */
export function PlusIcon(props: IconProps) {
  const id = useId();
  return (
    <Svg {...props}>
      <defs>
        <Grad id={`${id}p`} from="#ffd9e0" to="#ff7a8a" />
      </defs>
      <path d="M16 6v20M6 16h20" stroke={`url(#${id}p)`} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

/** Small cross for remove buttons. */
export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 8l16 16M24 8L8 24" stroke="currentColor" strokeWidth="3.600" strokeLinecap="round" />
    </Svg>
  );
}

/** Brand mark: a cute bat. */
export function BatMark({ size = 32, className }: IconProps) {
  const id = useId();
  return (
    <Svg size={size} className={className} viewBox="0 0 48 32">
      <defs>
        <Grad id={`${id}b`} from="#ff6f86" to="#7b2a86" />
      </defs>
      {/* wings with scalloped edges */}
      <path
        d="M19 13C14 7 7 6 2 10c2 2 2.500 4.500 1.500 7.500 3-1.500 5 .0 5.800 3 1.500-2.500 3.700-2.500 5.200.5.800-2 2.200-2.500 4.500-2.500z"
        fill={`url(#${id}b)`}
        stroke="#2a0a22"
        strokeWidth="1.200"
        strokeLinejoin="round"
      />
      <path
        d="M29 13c5-6 12-7 17-3-2 2-2.500 4.500-1.500 7.500-3-1.500-5 0-5.800 3-1.500-2.500-3.700-2.500-5.200.5-.8-2-2.200-2.500-4.500-2.500z"
        fill={`url(#${id}b)`}
        stroke="#2a0a22"
        strokeWidth="1.200"
        strokeLinejoin="round"
      />
      {/* ears and body */}
      <path d="M18.500 5.500l3 4.500h5l3-4.500 .5 7.500a6.500 7.500 0 0 1-12 0z" fill={`url(#${id}b)`} stroke="#2a0a22" strokeWidth="1.200" strokeLinejoin="round" />
      <ellipse cx="24" cy="21" rx="5.500" ry="7" fill={`url(#${id}b)`} stroke="#2a0a22" strokeWidth="1.200" />
      {/* face */}
      <circle cx="21.200" cy="13" r="1.800" fill="#fff" />
      <circle cx="26.800" cy="13" r="1.800" fill="#fff" />
      <circle cx="21.500" cy="13.300" r="0.900" fill="#2a0a22" />
      <circle cx="27.100" cy="13.300" r="0.900" fill="#2a0a22" />
      <path d="M22.300 16.200l.7 2 .7-2zM24.300 16.200l.7 2 .7-2z" fill="#fff" stroke="#2a0a22" strokeWidth="0.4" strokeLinejoin="round" />
    </Svg>
  );
}

/** Small shape beside the state word, so state is never colour alone. */
export function StateShape({ state, size = 14 }: { state: VampireState; size?: number }) {
  return (
    <Svg size={size} viewBox="0 0 16 16">
      {state === 'awake' && (
        <>
          <circle cx="8" cy="8" r="3.200" fill="currentColor" />
          <path d="M8 1.500v2M8 12.500v2M1.500 8h2M12.500 8h2M3.400 3.400l1.400 1.400M11.200 11.200l1.400 1.400M12.600 3.400l-1.400 1.400M4.800 11.200l-1.400 1.400" stroke="currentColor" strokeWidth="1.300" strokeLinecap="round" />
        </>
      )}
      {state === 'starving' && (
        <path d="M8 1.500c.6 2.400 3.800 4 3.800 7.400A3.800 3.800 0 0 1 8 14.500a3.800 3.800 0 0 1-3.800-5.600c.4.900.9 1.300 1.500 1.500C5.400 7 6.500 3.500 8 1.500z" fill="currentColor" />
      )}
      {state === 'asleep' && (
        <path d="M11.500 2.200a6 6 0 1 0 2.300 9.700A5 5 0 0 1 11.500 2.200z" fill="currentColor" />
      )}
      {state === 'protected' && (
        <path d="M8 1.500l5 1.800v4.200c0 3-2.100 5.400-5 7-2.900-1.600-5-4-5-7V3.300z" fill="currentColor" />
      )}
    </Svg>
  );
}

/**
 * Flat vampire emblem for the portrait slot. Spec 4 replaces it with the 3D vampire.
 * The face changes with the state: wide eyes, hungry eyes, closed eyes, or a sweat drop.
 */
export function VampireEmblem({ state }: { state: VampireState }) {
  const id = useId();
  return (
    <svg
      className="emblem"
      width="96"
      height="112"
      viewBox="0 0 96 112"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}cape`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="#1b0e26" />
        </linearGradient>
        <linearGradient id={`${id}face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2f4" />
          <stop offset="1" stopColor="#e9cdd8" />
        </linearGradient>
      </defs>
      {/* cape and high collar */}
      <path d="M8 112c2-26 14-40 40-40s38 14 40 40z" fill={`url(#${id}cape)`} />
      <path d="M26 72l-14-20 24 10zM70 72l14-20-24 10z" fill="#1b0e26" stroke="currentColor" strokeWidth="1.500" strokeLinejoin="round" />
      <path d="M38 76l10 14 10-14z" fill="#fff2f4" />
      {/* head */}
      <ellipse cx="48" cy="46" rx="26" ry="27" fill={`url(#${id}face)`} stroke="#1b0e26" strokeWidth="2" />
      {/* hair with widow's peak */}
      <path d="M21 42c0-17 11-26 27-26s27 9 27 26c-6-3-12-8-15-13-3 6-9 9-12 9s-9-3-12-9c-3 5-9 10-15 13z" fill="#1b0e26" />
      {/* cheeks */}
      <ellipse cx="32" cy="55" rx="5" ry="3.200" fill="#ff9fb3" opacity="0.7" />
      <ellipse cx="64" cy="55" rx="5" ry="3.200" fill="#ff9fb3" opacity="0.7" />
      {/* eyes */}
      {state === 'asleep' ? (
        <>
          <path d="M33 47q4 4 8 0M55 47q4 4 8 0" stroke="#1b0e26" strokeWidth="2.600" strokeLinecap="round" fill="none" />
          <text x="68" y="26" fontSize="12" fontWeight="700" fill="currentColor" fontFamily="Sora, sans-serif">z</text>
          <text x="76" y="16" fontSize="9" fontWeight="700" fill="currentColor" fontFamily="Sora, sans-serif">z</text>
        </>
      ) : state === 'starving' ? (
        <>
          <ellipse cx="37" cy="47" rx="5" ry="6" fill="#1b0e26" />
          <ellipse cx="59" cy="47" rx="5" ry="6" fill="#1b0e26" />
          <circle cx="37" cy="47" r="2.600" fill="currentColor" />
          <circle cx="59" cy="47" r="2.600" fill="currentColor" />
          <path d="M30 40l12 3M66 40l-12 3" stroke="#1b0e26" strokeWidth="2.400" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="37" cy="47" rx="5" ry="6.500" fill="#1b0e26" />
          <ellipse cx="59" cy="47" rx="5" ry="6.500" fill="#1b0e26" />
          <circle cx="38.800" cy="44.800" r="1.800" fill="#fff" />
          <circle cx="60.800" cy="44.800" r="1.800" fill="#fff" />
        </>
      )}
      {/* mouth and fangs */}
      <path d="M40 60q8 6 16 0" stroke="#1b0e26" strokeWidth="2.200" strokeLinecap="round" fill="none" />
      <path d="M42.500 60.500l2 6 2-5zM53.500 60.500l-2 6-2-5z" fill="#fff" stroke="#1b0e26" strokeWidth="1" strokeLinejoin="round" />
      {state === 'protected' && (
        <path d="M78 30c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9z" fill="#8fd8ff" stroke="#1b0e26" strokeWidth="1.200" />
      )}
    </svg>
  );
}
