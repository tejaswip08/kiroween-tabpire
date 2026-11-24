import { lazy, Suspense, useEffect, useState } from 'react';
import type { SceneInputs } from '../../../lib/scene/meaning';
import { DEFAULT_THEME, type ThemeId } from '../../../lib/themes';
import { clearPortraitsReady } from './portraitReady';
import { LayerBoundary } from './LayerBoundary';
import { useWebgl } from './useWebgl';

// The 3D code is a separate chunk. These imports run only when WebGL is available.
const SceneLayer = lazy(() => import('./SceneLayer'));
const PortraitLayer = lazy(() => import('./PortraitLayer'));

/** True after the page has painted once, so 3D loading never delays the first paint. */
function useAfterFirstPaint(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setDone(true), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);
  return done;
}

/** Whether to load a 3D layer now. Without WebGL, nothing 3D is loaded and no error is shown.
 * When the context is lost the layer stays mounted but hidden, because its canvas is the one that is
 * told when the context returns. It then mounts fresh (the epoch changes). */
function useLayerGate(): { show: boolean; lost: boolean; epoch: number } {
  const { available, lost, epoch } = useWebgl();
  const painted = useAfterFirstPaint();
  return { show: available && painted, lost, epoch };
}

/** The full-window graveyard behind the page. Hidden from screen readers, takes no clicks. */
export function SceneLayerHost({ inputs, themeId = DEFAULT_THEME }: { inputs: SceneInputs; themeId?: ThemeId }) {
  const { show, lost, epoch } = useLayerGate();
  if (!show) return null;
  return (
    <div className="scene-host" aria-hidden="true" data-testid="scene-host" data-lost={lost}>
      <LayerBoundary resetKey={epoch}>
        <Suspense fallback={null}>
          <SceneLayer key={epoch} inputs={inputs} themeId={themeId} />
        </Suspense>
      </LayerBoundary>
    </div>
  );
}

/** The shared canvas that draws every card's vampire. It sits below the cards. */
export function PortraitLayerHost({ themeId = DEFAULT_THEME }: { themeId?: ThemeId }) {
  const { show, lost, epoch } = useLayerGate();
  useEffect(() => {
    // While the context is lost (or the layer is gone), every card shows its emblem again.
    if (!show || lost) clearPortraitsReady();
  }, [show, lost]);
  if (!show) return null;
  return (
    <div className="portrait-host" aria-hidden="true" data-testid="portrait-host" data-lost={lost}>
      <LayerBoundary resetKey={epoch} onFail={clearPortraitsReady}>
        <Suspense fallback={null}>
          <PortraitLayer key={epoch} themeId={themeId} />
        </Suspense>
      </LayerBoundary>
    </div>
  );
}
