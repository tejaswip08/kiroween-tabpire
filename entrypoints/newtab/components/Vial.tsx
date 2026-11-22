import { useId } from 'react';
import { VIAL_TICK } from '../../../lib/view';

// The liquid is a rectangle that exactly fills the inside of the glass (top 12, bottom 114).
// Scaling it from the bottom gives the fill level, so the tick uses the same numbers.
const TOP = 12;
const HEIGHT = 102;

/**
 * Blood vial hunger meter. The liquid is drawn full size and scaled
 * from the bottom with a transform. The tick marks the 1 day line,
 * where a tab becomes Starving.
 */
export function Vial({ fill, label }: { fill: number; label: string }) {
  const id = useId();
  const clamped = Math.min(1, Math.max(0, fill));
  const tickY = TOP + HEIGHT * (1 - VIAL_TICK);

  return (
    <svg
      className="vial"
      width="30"
      height="124"
      viewBox="0 0 30 124"
      role="img"
      aria-label={label}
      data-fill={clamped.toFixed(3)}
    >
      <defs>
        <clipPath id={`${id}clip`}>
          <path d="M7 12h16v94a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8z" />
        </clipPath>
        <linearGradient id={`${id}blood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--blood-top)" />
          <stop offset="1" stopColor="var(--blood-bottom)" />
        </linearGradient>
        <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      {/* empty glass */}
      <path d="M7 12h16v94a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8z" fill="rgba(10, 4, 16, 0.55)" />
      {/* liquid */}
      <g clipPath={`url(#${id}clip)`}>
        {/* A little blood always sits in the bottom, so a fresh tab's vial does not look empty. */}
        <path className="vial-pool" d={`M6 ${TOP + HEIGHT - 11}q3 -2.600 6 0t6 0V${TOP + HEIGHT}H6z`} fill={`url(#${id}blood)`} opacity="0.9" />
        <rect
          className="vial-liquid"
          x="6"
          y={TOP}
          width="18"
          height={HEIGHT}
          fill={`url(#${id}blood)`}
          style={{ transform: `scaleY(${clamped})` }}
        />
      </g>
      {/* glass shine and outline */}
      <path d="M7 12h16v94a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8z" fill={`url(#${id}glass)`} stroke="rgba(255,255,255,0.55)" strokeWidth="1.200" />
      <path d="M10.500 18v80" stroke="#fff" strokeWidth="1.600" strokeLinecap="round" opacity="0.45" />
      {/* 1 day line */}
      <path d={`M7 ${tickY}h-4M23 ${tickY}h4`} stroke="var(--ink)" strokeWidth="1.600" strokeLinecap="round" />
      {/* cork */}
      <rect x="9" y="3" width="12" height="9" rx="2.500" fill="#b07a4a" stroke="#4a2a12" strokeWidth="1" />
      <path d="M11 6h8" stroke="#d9a671" strokeWidth="1.200" strokeLinecap="round" />
      <rect x="5" y="10.500" width="20" height="3.500" rx="1.700" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
    </svg>
  );
}
