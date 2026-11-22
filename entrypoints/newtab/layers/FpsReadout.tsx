import { useEffect, useState } from 'react';
import { fpsRequested, useFps } from './fpsStore';

const nf = new Intl.NumberFormat('en-US');

function useWantsFps(): boolean {
  const [wanted, setWanted] = useState(() => fpsRequested(window.location.href));
  useEffect(() => {
    const update = () => setWanted(fpsRequested(window.location.href));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return wanted;
}

function Readout() {
  const s = useFps();
  return (
    <div className="fps-readout" aria-hidden="true">
      <span>{s.fps} fps</span>
      <span>worst {s.worstMs.toFixed(1)} ms</span>
      <span>
        scene {s.scene.calls} calls, {nf.format(s.scene.triangles)} tris
      </span>
      <span>
        portraits {s.portrait.calls} calls, {nf.format(s.portrait.triangles)} tris
      </span>
    </div>
  );
}

/** Small diagnostics box, shown only when the address ends with `#fps`. */
export function FpsReadout() {
  return useWantsFps() ? <Readout /> : null;
}
