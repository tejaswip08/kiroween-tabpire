import { useEffect } from 'react';
import { GraveyardCanvas } from './three/GraveyardScene';

/** A corner cobweb with a spider bobbing on its thread. */
function Cobweb() {
  const spokes = [0, 18, 36, 54, 72, 90];
  const rings = [45, 90, 135, 180];
  const pt = (r: number, deg: number) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  return (
    <g className="n-web" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" fill="none">
      {spokes.map((d) => {
        const [x, y] = pt(220, d);
        return <path key={d} d={`M0 0 L${x} ${y}`} />;
      })}
      {rings.map((r) => (
        <path
          key={r}
          d={spokes
            .slice(1)
            .map((d, i) => {
              const [x0, y0] = pt(r, spokes[i]!);
              const [x1, y1] = pt(r, d);
              const [cx, cy] = pt(r * 0.86, (spokes[i]! + d) / 2);
              return `${i ? '' : `M${x0} ${y0} `}Q${cx} ${cy} ${x1} ${y1}`;
            })
            .join(' ')}
        />
      ))}
      <g className="n-spider">
        <path d="M150 0 V118" strokeOpacity="0.25" />
        <g transform="translate(150 128)" stroke="#120720" strokeOpacity="1" strokeWidth="2">
          <path d="M-4 -2 L-14 -10 L-18 -2 M-4 2 L-15 4 L-18 12 M4 -2 L14 -10 L18 -2 M4 2 L15 4 L18 12" />
          <circle cx="0" cy="0" r="7" fill="#120720" />
          <circle cx="0" cy="-8" r="4.5" fill="#120720" />
          <circle cx="-1.6" cy="-8.5" r="1.1" fill="#ff3b4d" stroke="none" />
          <circle cx="1.6" cy="-8.5" r="1.1" fill="#ff3b4d" stroke="none" />
        </g>
      </g>
    </g>
  );
}

/**
 * The night behind every page: a full 3D graveyard (KayKit models, low-poly clouds, witches, bats and
 * ghosts, moonlight, fog, bloom), with a cobweb in the corner. Purely decorative.
 */
export function Atmosphere(_props: { bats?: number }) {
  return (
    <>
    <GraveyardCanvas />
    <div className="night" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">

        <Cobweb />

      </svg>
    </div>
    </>
  );
}

/** Exposes the pointer position as --mx/--my (-1..1) so vampire eyes and the scene can follow it. */
export function usePointerVars() {
  useEffect(() => {
    let frame = 0;
    const root = document.documentElement;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--mx', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty('--my', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
      });
    };
    addEventListener('pointermove', onMove);
    return () => {
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
}
