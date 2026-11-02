// Small line icons that inherit currentColor.
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const StakeIcon = () => (
  <svg {...base}>
    <path d="M3 21 L13 11" />
    <path d="M13 11 L16 8 L18.5 10.5 L15.5 13.5Z" fill="currentColor" />
    <path d="M17 5 L21 3 L19 7" />
  </svg>
);

export const CoffinIcon = () => (
  <svg {...base}>
    <path d="M9 2 H15 L18.5 8 L16 22 H8 L5.5 8Z" />
    <path d="M12 8 V15 M9.5 10.5 H14.5" />
  </svg>
);

export const UrnIcon = () => (
  <svg {...base}>
    <path d="M8 3 H16" />
    <path d="M9.5 3 V5.5 C6.5 7 5 9.5 5 12.5 C5 17 8 21 12 21 C16 21 19 17 19 12.5 C19 9.5 17.5 7 14.5 5.5 V3" />
    <path d="M7.5 13 H16.5" />
  </svg>
);

export const GarlicIcon = () => (
  <svg {...base}>
    <path d="M12 3 C12 6 6 8 6 14 A6 6 0 0 0 18 14 C18 8 12 6 12 3Z" />
    <path d="M12 9 V19 M9 12 C9 15 10 17 11 19 M15 12 C15 15 14 17 13 19" />
  </svg>
);

export const SunIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <path d="M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M4.9 19.1 L6.3 17.7 M17.7 6.3 L19.1 4.9" />
  </svg>
);

export const WakeIcon = () => (
  <svg {...base}>
    <path d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const BloodIcon = () => (
  <svg {...base}>
    <path d="M12 3 C12 3 5 11 5 15 A7 7 0 0 0 19 15 C19 11 12 3 12 3Z" fill="currentColor" />
  </svg>
);

export const BAT_PATH =
  'M32 12 C29 8 26 8 24 12 C20 6 12 4 2 8 C8 10 10 14 10 18 C14 15 18 15 20 18 C22 15 26 15 28 20 L32 16 L36 20 C38 15 42 15 44 18 C46 15 50 15 54 18 C54 14 56 10 62 8 C52 4 44 6 40 12 C38 8 35 8 32 12Z';

export const Bat = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 26" className={className} aria-hidden="true">
    <path d={BAT_PATH} fill="currentColor" />
  </svg>
);
