// Dev-only gallery of every vampire stage and action effect, outside the extension.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../components/theme.css';
import { Atmosphere } from '../../components/Atmosphere';
import { Portrait, SharedCanvas } from '../../components/three/Portrait';
import { FX_MS, type Fx } from '../../components/three/toon';
import type { Stage } from '../../lib/hunger';

const CASES: { stage: Stage; pallor: number; label: string }[] = [
  { stage: 'feeding', pallor: 0, label: 'Feeding' },
  { stage: 'fresh', pallor: 0.05, label: 'Fresh' },
  { stage: 'fresh', pallor: 0.6, label: 'Greying (14 h idle)' },
  { stage: 'starving', pallor: 1, label: 'Starving' },
  { stage: 'garlic', pallor: 0.2, label: 'Garlic' },
  { stage: 'coffin', pallor: 0, label: 'Coffin' },
];

function Preview() {
  const [fx, setFx] = useState<Fx | undefined>();
  const [cheer, setCheer] = useState(0);
  const run = (k: Fx) => {
    setFx(undefined);
    requestAnimationFrame(() => setFx(k));
    setTimeout(() => setFx(undefined), FX_MS[k] + 400);
  };
  return (
    <>
      <Atmosphere />
      <main style={{ position: 'relative', zIndex: 1, padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['stake', 'crypt', 'coffin', 'burn'] as Fx[]).map((k) => (
            <button key={k} className="btn" onClick={() => run(k)}>{k}</button>
          ))}
          <button className="btn" onClick={() => setCheer((c) => c + 1)}>cheer</button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 180px)', gap: 12 }}>
          {CASES.map((c, i) => (
            <div key={c.label} style={{ textAlign: 'center' }}>
              <Portrait style={{ width: 180, height: 210, display: 'block' }} stage={c.stage} pallor={c.pallor} variant={i} cheer={cheer} />
              <p style={{ margin: 4, color: 'var(--muted)' }}>{c.label}</p>
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--muted)' }}>Effect target (fresh):</p>
        <Portrait style={{ width: 220, height: 250, display: 'block' }} stage="fresh" pallor={0} variant={7} fx={fx} />
      </main>
      <SharedCanvas />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
