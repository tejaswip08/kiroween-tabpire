import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { browser } from 'wxt/browser';
import { Atmosphere, usePointerVars } from '../../components/Atmosphere';
import { Haunts } from './Haunts';
import { SearchBar } from './Search';
import { TipProvider, Tipped, useTip } from '../../components/Tooltip';
import { CountUp } from '../../components/CountUp';
import {
  BloodIcon,
  CoffinIcon,
  GarlicIcon,
  StakeIcon,
  SunIcon,
  UrnIcon,
  WakeIcon,
  Bat,
} from '../../components/Icons';
import { Portrait, SharedCanvas } from '../../components/three/Portrait';
import { FX_MS, type Fx } from '../../components/three/toon';
import { useCrypt } from '../../components/useCrypt';
import {
  DAY,
  HOUR,
  appetiteMb,
  dawnTargets,
  formatIdle,
  formatMb,
  hostOf,
  idleMs,
  pallor,
  stageOf,
  type Stage,
  type TabLike,
} from '../../lib/hunger';
import { load, save } from '../../lib/store';
import { coffin, crypt, dawn, openBloodBank, stake, toggleGarlic, wake } from '../../lib/tabs';


// One name per state, used on the legend, the card badge and the explainers alike.
const STAGE_LABEL: Record<Stage, string> = {
  feeding: 'Awake',
  fresh: 'Awake',
  starving: 'Starving',
  coffin: 'Asleep',
  garlic: 'Protected',
};

// What each state means, in plain words, for the hover explainers.
const STAGE_HELP: Record<Stage, string> = {
  starving: 'Not touched for over a day, but still holding memory. Dawn will burn it (it’s saved to the crypt first, so nothing is lost).',
  feeding: 'Open right now or playing sound. Dawn never touches it.',
  fresh: 'Used in the last day. As the hours pass it slowly turns grey, and after a full day without a visit it starts starving.',
  coffin: 'Suspended: it stays in your tab bar but uses no memory. Wake it to load it again.',
  garlic: 'This whole site is protected by garlic. Tabpire will never flag or burn it.',
};

/** What the vampire says about itself, in its own voice. */
function vampireSays(stage: Stage, tab: TabLike, idle: number, mb: number): string {
  const ago = formatIdle(idle);
  const sip = `~${formatMb(mb)}`;
  switch (stage) {
    case 'starving':
      return `${ago} without a visit… I’m STARVING. And I’m still drinking ${sip} of your memory while I wait.`;
    case 'feeding':
      return tab.audible ? `I’m playing for you right now. Don’t you dare stake me mid-song.` : `Mmm, you’re using me right now. Every drop of ${sip} is worth it.`;
    case 'fresh':
      return idle < 60_000
        ? 'You visited me just now. I’m well fed and behaving.'
        : `You visited me ${ago} ago. ${idle > 6 * HOUR ? 'I’m getting a little grey… visit me before tomorrow.' : 'I’m still well fed.'}`;
    case 'coffin':
      return `Zzz… I’m asleep in my coffin. Not drinking a single drop. Wake me when you need me.`;
    case 'garlic':
      return `Garlic?! Keep it away from me. You can’t hunt me now… but I’m still sipping ${sip}.`;
  }
}

// Legend order follows a tab's life: awake, then starving; asleep and protected sit apart.
const GROUPS: { key: string; title: string; when: string; hint: string; say: (n: number) => string; stages: Stage[] }[] = [
  {
    key: 'awake',
    title: 'Awake',
    when: 'used < 1 day',
    hint: 'Tabs you’ve used in the last day, or that are open or playing sound right now. Dawn never touches them. Their hunger bar fills as the day goes by.',
    say: (n) => (n ? `${n === 1 ? 'I’m' : 'We’re'} awake and well fed. You keep coming back for us.` : 'Nobody’s awake… did you forget about all of us?'),
    stages: ['feeding', 'fresh'],
  },
  {
    key: 'starving',
    title: 'Starving',
    when: 'idle 1 day+',
    hint: 'Tabs you haven’t used for over a day that are still eating memory. The safest ones to slay. Dawn burns them all at once (each is saved to the crypt first).',
    say: (n) => (n ? `We’re STARVING! ${n} of us, forgotten for days… and we’re still drinking your memory.` : 'None of us are starving… yet. Leave a tab alone for a day and see.'),
    stages: ['starving'],
  },
  {
    key: 'coffin',
    title: 'Asleep',
    when: 'in a coffin',
    hint: 'Tabs you put in a coffin. They stay in your tab bar but use no memory until you click them.',
    say: (n) => (n ? 'Zzz… we’re sleeping in our coffins. Not a drop of your memory.' : 'No one is sleeping. Coffin a tab to stop it drinking.'),
    stages: ['coffin'],
  },
  {
    key: 'garlic',
    title: 'Protected',
    when: 'garlic',
    hint: 'Sites you hung garlic on. They’re never marked fading or starving and Dawn never burns them, but they still use memory.',
    say: (n) => (n ? 'Garlic everywhere… we can’t be hunted. We’re still sipping, though.' : 'No garlic hung yet. Protect sites you always keep open.'),
    stages: ['garlic'],
  },
];

// Hungriest first so the ones worth killing are at the top.
const STAGE_ORDER: Stage[] = ['starving', 'feeding', 'fresh', 'coffin', 'garlic'];

const GAP = 12;
const MIN_W = 84;
const MAX_W = 196;
// Card sizes: full (all details), compact (no host/idle), mini (title only, actions on hover).
const COMPACT_W = 150;
const MINI_W = 112;
/** Card height for a card width: the portrait scales, the text and buttons don't. */
const cardH = (w: number) => (w < MINI_W ? 46 : w < COMPACT_W ? 116 : 162) + Math.round(w * 0.72);

/** Largest card size that fits `n` cards inside a W×H box without scrolling. */
function fitCards(W: number, H: number, n: number) {
  for (let w = MAX_W; w >= MIN_W; w -= 2) {
    const cols = Math.max(1, Math.floor((W + GAP) / (w + GAP)));
    const rows = Math.ceil(n / cols);
    if (rows * cardH(w) + (rows - 1) * GAP <= H) return { w, cols, fits: true };
  }
  return { w: MIN_W, cols: Math.max(1, Math.floor((W + GAP) / (MIN_W + GAP))), fits: false };
}

function useFit(n: number) {
  const ref = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ W: 1200, H: 500 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setBox({ W: e.contentRect.width, H: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const f = fitCards(box.W, box.H, Math.max(1, n));
  return { ref, w: f.w, h: cardH(f.w), cols: f.cols, fits: f.fits, size: f.w < MINI_W ? 'mini' : f.w < COMPACT_W ? 'compact' : 'full' };
}

const short = (s: string, n = 34) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function Crypt() {
  usePointerVars();
  const { tabs, store, time, garlic } = useCrypt();
  const [fx, setFx] = useState<Map<number, Fx>>(new Map());
  const [toast, setToast] = useState<{ id: number; text: ReactNode } | null>(null);
  const [sunrise, setSunrise] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const targets = dawnTargets(tabs, time, garlic);
  const draining = tabs.reduce((sum, t) => sum + appetiteMb(t), 0);
  const starvingCount = tabs.filter((t) => stageOf(t, time, garlic) === 'starving').length;
  const fit = useFit(tabs.length);
  const hallRef = fit.ref;
  const fitStyle = {
    ['--card-w' as string]: `${fit.w}px`,
    ['--card-h' as string]: `${fit.h}px`,
    ['--cols' as string]: fit.cols,
    overflowY: fit.fits ? 'hidden' : 'auto',
  } as React.CSSProperties;

  function say(text: ReactNode) {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  async function play(ids: number[], kind: Fx, action: () => Promise<unknown>) {
    setFx((m) => new Map([...m, ...ids.map((id) => [id, kind] as const)]));
    await new Promise((r) => setTimeout(r, FX_MS[kind]));
    try {
      await action();
    } finally {
      setFx((m) => {
        const next = new Map(m);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  const act = {
    stake: (t: TabLike) =>
      play([t.id], 'stake', async () => {
        await stake(t);
        say(<>Staked <b>{short(t.title)}</b> · ~{formatMb(appetiteMb(t))} reclaimed</>);
      }),
    crypt: (t: TabLike) =>
      play([t.id], 'crypt', async () => {
        await crypt(t);
        say(<>Sealed <b>{short(t.title)}</b> in the crypt · ~{formatMb(appetiteMb(t))} reclaimed</>);
      }),
    coffin: (t: TabLike) =>
      play([t.id], 'coffin', async () => {
        await coffin(t);
        say(<><b>{short(t.title)}</b> sleeps in its coffin · ~{formatMb(appetiteMb(t))} freed</>);
      }),
    wake: (t: TabLike) => wake(t),
    garlic: async (t: TabLike) => {
      const host = hostOf(t.url);
      const had = garlic.has(host);
      await toggleGarlic(t.url);
      say(had ? <>Garlic removed from <b>{host}</b></> : <>Garlic hung on <b>{host}</b>. It will never be flagged.</>);
    },
  };

  async function runDawn() {
    if (!targets.length) return;
    const mb = targets.reduce((s, t) => s + appetiteMb(t), 0);
    const count = targets.length;
    setSunrise(true);
    await play(targets.map((t) => t.id), 'burn', () => dawn(tabs));
    say(<>Dawn burned <b>{count} vampire{count === 1 ? '' : 's'}</b> · ~{formatMb(mb)} reclaimed. They rest in the crypt.</>);
    setTimeout(() => setSunrise(false), 700);
  }

  const sorted = [...tabs].sort((a, b) => {
    const d = STAGE_ORDER.indexOf(stageOf(a, time, garlic)) - STAGE_ORDER.indexOf(stageOf(b, time, garlic));
    return d || idleMs(b, time) - idleMs(a, time);
  });
  const counts = GROUPS.map((g) => ({ ...g, n: tabs.filter((t) => g.stages.includes(stageOf(t, time, garlic))).length }));

  return (
    <MotionConfig reducedMotion="user">
      <TipProvider>
      <Atmosphere />
      <main className={`crypt${tabs.length > 18 ? ' crowded' : ''}`}>
        <motion.header
          className="topbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Tipped
            className="brand"
            id="brand"
            content={<TipText title="What is this?">Every open tab is a vampire feeding on your memory. The longer you ignore a tab, the hungrier it gets. Close, suspend or save the hungry ones here.</TipText>}
          >
            <p className="eyebrow">Tabpire</p>
            <h1>The Crypt</h1>
            <p className="tagline">Your tabs are draining you. Stake them.</p>
          </Tipped>

          <div className="vitals">
            <Vital
              label="Vampires"
              value={String(tabs.length)}
              sub={starvingCount ? `${starvingCount} starving` : 'none starving'}
              hot={starvingCount > 0}
              help="Every tab you have open, except this one. A vampire starts starving after a day without being used."
            />
            <Vital
              label="Draining now"
              value={<>~<CountUp value={draining} format={formatMb} /></>}
              sub="estimated memory"
              vial={Math.min(1, draining / 4096)}
              help="Roughly how much memory your open tabs use. Chrome doesn’t tell extensions the exact figure, so Tabpire estimates it from the site and whether it’s playing sound."
            />
            <Vital
              label="Blood reclaimed"
              value={<CountUp value={store?.stats.reclaimedMb ?? 0} format={formatMb} />}
              sub={`${(store?.stats.staked ?? 0) + (store?.stats.crypted ?? 0)} slain`}
              help="Memory freed by every tab you’ve staked, coffined or sent to the crypt. See the full history in the Blood Bank."
            />
          </div>

          <div className="hero-actions">
            <Tipped id="bank" content={<TipText title="Blood Bank">Your history: memory reclaimed, every action you’ve taken, and the tabs saved in the crypt, which you can reopen any time.</TipText>}>
              <button className="btn" onClick={() => openBloodBank({ sameTab: true })}>
                <BloodIcon /> Blood Bank
              </button>
            </Tipped>
            <Tipped
              id="dawn"
              content={
                <TipText
                  title={targets.length ? `Dawn · burns ${targets.length} starving` : 'Dawn'}
                  say={targets.length ? 'When the sun rises, the starving ones burn. Even I can’t save them.' : 'No one is starving. The sun can wait.'}
                >
                  {targets.length
                    ? `Closes every starving tab at once and frees ~${formatMb(targets.reduce((s, t) => s + appetiteMb(t), 0))}. Each one is saved to the crypt first, so you can bring it back.`
                    : 'Nothing is starving right now. Dawn closes tabs that have been idle for over a day.'}
                  <span className="tip-note">Never touches the tab you’re on, tabs playing sound, pinned tabs or garlic sites.</span>
                </TipText>
              }
            >
              <button className="btn btn-dawn" disabled={!targets.length || sunrise} onClick={runDawn}>
                <SunIcon /> {targets.length ? `Dawn · burn ${targets.length}` : 'Dawn'}
              </button>
            </Tipped>
          </div>
        </motion.header>


        <SearchBar tabs={tabs} pages={store?.haunts ?? []} crypt={store?.crypt ?? []} />
        <Haunts haunts={store?.haunts ?? []} />

        {tabs.length > 0 && (
          <ul className="legend" aria-label="Vampires by state">
            {counts.map((g) => (
              <LegendChip key={g.key} id={g.key} title={g.title} when={g.when} hint={g.hint} say={g.say(g.n)} n={g.n} />
            ))}
          </ul>
        )}

        <section className="hall" ref={hallRef} style={fitStyle}>
          {tabs.length === 0 ? (
            <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Bat className="empty-bat" />
              <h2>The crypt is quiet</h2>
              <p>No vampires feed tonight. Every other tab is closed.</p>
            </motion.div>
          ) : (
            <motion.ul className={`grid size-${fit.size}`} layout>
              <AnimatePresence mode="popLayout">
                {sorted.map((tab, i) => (
                  <VampireCard
                    key={tab.id}
                    index={i}
                    tab={tab}
                    stage={stageOf(tab, time, garlic)}
                    pale={pallor(tab, time)}
                    idle={idleMs(tab, time)}
                    fx={fx.get(tab.id)}
                    act={act}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </section>
      </main>

      <AnimatePresence>
        {sunrise && (
          <motion.div
            className="sunrise"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.2 } }}
            transition={{ duration: 0.6 }}
          >
            <div className="sun" />
            <div className="rays" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="toast-wrap" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className="toast"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <BloodIcon /> <span>{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SharedCanvas />

      {import.meta.env.DEV && <DebugPanel warp={store?.timeWarpMs ?? 0} />}
      </TipProvider>
    </MotionConfig>
  );
}

function Vital({ label, value, sub, vial, hot, help }: { label: string; value: ReactNode; sub: string; vial?: number; hot?: boolean; help: string }) {
  const tip = useTip(<TipText title={label}>{help}</TipText>, `vital-${label}`);
  return (
    <div className={`vital${hot ? ' vital-hot' : ''}`} tabIndex={0} {...tip}>
      <span className="vital-label">{label}</span>
      <strong>{value}</strong>
      {vial !== undefined && (
        <div className="vital-vial">
          <span style={{ width: `${Math.max(4, vial * 100)}%` }} />
        </div>
      )}
      <span className="vital-sub">{sub}</span>
    </div>
  );
}

interface CardProps {
  tab: TabLike;
  stage: Stage;
  pale: number;
  idle: number;
  index: number;
  fx?: Fx;
  act: Record<'stake' | 'crypt' | 'coffin' | 'wake' | 'garlic', (t: TabLike) => unknown>;
}

function VampireCard({ tab, stage, pale, idle, index, fx, act }: CardProps) {
  const mb = appetiteMb(tab);
  const host = hostOf(tab.url) || 'local page';
  const busy = !!fx;
  const tip = useTip(
    <div className="tip-card">
      <p className="tip-head">
        {tab.favIconUrl && <img src={tab.favIconUrl} alt="" />}
        <span>{tab.title}</span>
      </p>
      <p className="tip-host">{host}</p>
      <p className={`tip-state tip-${stage}`}>
        <span className="legend-dot" /> {STAGE_LABEL[stage]}
        {stage !== 'coffin' && stage !== 'garlic' && <> · hunger {Math.round(pale * 100)}%</>}
      </p>
      <p className="tip-say">“{vampireSays(stage, tab, idle, mb)}”</p>
      <p>{STAGE_HELP[stage]}</p>
      <dl>
        <dt>Last used</dt>
        <dd>{tab.active ? 'open now' : idle < 60_000 ? 'just now' : `${formatIdle(idle)} ago`}</dd>
        <dt>Memory</dt>
        <dd>{stage === 'coffin' ? '0 MB (asleep)' : `~${formatMb(mb)}${tab.audible ? ' · playing sound' : ''}`}</dd>
      </dl>
    </div>,
    `card-${tab.id}-${stage}`,
  );

  return (
    <motion.li
      layout
      className={`card card-${stage}${fx ? ` fx-${fx}` : ''}`}
      initial={{ opacity: 0, y: 36, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, filter: 'blur(8px)', transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: Math.min(index * 0.035, 0.5) }}
      whileHover={busy ? undefined : { y: -6 }}
    >
      <div className="portrait" tabIndex={0} aria-label={`${tab.title}: ${STAGE_LABEL[stage]}`} {...tip}>
        <div className="halo" />
        <Portrait className="portrait-view" stage={stage} pallor={pale} variant={tab.id} fx={fx} />
        {stage === 'coffin' && !fx && (
          <span className="zzz" aria-hidden="true"><i>z</i><i>z</i><i>z</i></span>
        )}
      </div>

      <div className="card-body" {...tip}>
        <p className="host">
          {tab.favIconUrl ? <img src={tab.favIconUrl} alt="" /> : <span className="host-dot" />}
          {host}
        </p>
        <p className="title">{tab.title}</p>
        <div className="meta">
          <span className={`badge badge-${stage}`}>{STAGE_LABEL[stage]}</span>
          <span>{stage === 'coffin' ? 'asleep · 0 MB' : `${formatIdle(idle)} · ~${formatMb(mb)}`}</span>
        </div>
        {stage !== 'coffin' && stage !== 'garlic' && (
          <div className="hunger">
            <span style={{ width: `${Math.max(3, pale * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="actions">
        {stage === 'garlic' ? (
          <IconBtn
            label="Remove garlic"
            say="Finally, fresh air! I can feel my hunger coming back…"
            points={[`Tabpire watches every ${host} tab again.`, 'They can starve and be burned by Dawn like any other tab.']}
            onClick={() => act.garlic(tab)}
            disabled={busy}
          >
            <GarlicIcon />
          </IconBtn>
        ) : stage === 'coffin' ? (
          <>
            <IconBtn
              label="Wake"
              say="You called? I’m awake… and thirsty."
              points={['Switches to this tab and loads the page again.', 'It starts using memory again once it’s awake.']}
              onClick={() => act.wake(tab)}
              disabled={busy}
            >
              <WakeIcon />
            </IconBtn>
            <IconBtn
              label="Stake"
              say="Even in my sleep? You’re ruthless."
              points={['Closes this tab for good.']}
              note="Not saved anywhere. Want it later? Wake it and use Crypt instead."
              tone="blood"
              onClick={() => act.stake(tab)}
              disabled={busy}
            >
              <StakeIcon />
            </IconBtn>
          </>
        ) : (
          <>
            <IconBtn
              label="Stake · close for good"
              say="A stake? Through my heart?! …Fine. Take your blood back."
              points={[`Closes this tab now and gives you back ~${formatMb(mb)}.`]}
              note="Not saved anywhere. Want to read it later? Use Crypt instead."
              tone="blood"
              onClick={() => act.stake(tab)}
              disabled={busy}
            >
              <StakeIcon />
            </IconBtn>
            <IconBtn
              label="Coffin · put to sleep"
              say={tab.active ? 'You’re looking at me right now. I can’t sleep while you watch.' : 'Into my coffin… I’ll sleep right here in your tab bar.'}
              points={
                tab.active
                  ? ['Switch to another tab first, then come back here to coffin this one.']
                  : [`Frees ~${formatMb(mb)} while it sleeps.`, 'The tab stays in your tab bar. Click it to wake it exactly where you left off.']
              }
              onClick={() => act.coffin(tab)}
              disabled={busy || tab.active}
            >
              <CoffinIcon />
            </IconBtn>
            <IconBtn
              label="Crypt · save for later"
              say="Seal me in the crypt? I’ll rest there until you call me back."
              points={[
                `Closes this tab and gives you back ~${formatMb(mb)}.`,
                'Keeps its link and title safe in the Blood Bank → The crypt.',
                'Click Resurrect there any time to reopen the page.',
              ]}
              note="Saves the link only, not your scroll position or anything you typed. In the middle of something? Use Coffin."
              onClick={() => act.crypt(tab)}
              disabled={busy}
            >
              <UrnIcon />
            </IconBtn>
            <IconBtn
              label="Garlic · protect this site"
              say={`Garlic?! Ugh… fine, I’ll leave ${host} alone. But I’m still drinking.`}
              points={[
                `Protects every ${host} tab, now and in the future.`,
                'They never starve, and Dawn never burns them.',
                'Use it for sites you always keep open, like mail or chat.',
              ]}
              note="Garlic doesn’t free memory: the tab stays open. Undo it here or in the Blood Bank."
              tone="garlic"
              onClick={() => act.garlic(tab)}
              disabled={busy}
            >
              <GarlicIcon />
            </IconBtn>
          </>
        )}
      </div>
    </motion.li>
  );
}

interface IconBtnProps {
  label: string;
  /** The vampire's reaction, in its own voice. */
  say: string;
  /** What actually happens, in plain words. */
  points: string[];
  note?: string;
  onClick: () => unknown;
  disabled?: boolean;
  tone?: 'blood' | 'garlic';
  children: ReactNode;
}

function IconBtn({ label, say, points, note, onClick, disabled, tone, children }: IconBtnProps) {
  const tip = useTip(
    <div className="tip-card">
      <TipText title={label} say={say} />
      <ul className="tip-points">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {note && <span className="tip-note">{note}</span>}
    </div>,
    `btn-${label}-${say}`,
  );
  return (
    // A disabled button gets no mouse events, so the explainer sits on a wrapper.
    <span className="icon-wrap" {...tip}>
      <button className={`icon-btn${tone ? ` icon-${tone}` : ''}`} aria-label={`${label}. ${points.join(' ')}`} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    </span>
  );
}

function TipText({ title, say, children }: { title: string; say?: string; children?: ReactNode }) {
  return (
    <>
      <p className="tip-title">{title}</p>
      {say && <p className="tip-say">“{say}”</p>}
      {children && <p>{children}</p>}
    </>
  );
}

function LegendChip({ id, title, when, hint, say, n }: { id: string; title: string; when: string; hint: string; say: string; n: number }) {
  const tip = useTip(
    <div className="tip-card">
      <TipText title={`${title} · ${n}`} say={say}>
        {hint}
      </TipText>
    </div>,
    `legend-${id}-${n}`,
  );
  return (
    <li className={`legend-${id}${n ? '' : ' legend-empty'}`} tabIndex={0} {...tip}>
      <span className="legend-dot" />
      {title} <b>{n}</b>
      <small>{when}</small>
    </li>
  );
}

const TEST_SITES = [
  'https://www.youtube.com',
  'https://www.figma.com',
  'https://news.ycombinator.com',
  'https://en.wikipedia.org/wiki/Vampire',
  'https://developer.mozilla.org',
  'https://github.com',
  'https://www.reddit.com',
  'https://www.notion.so',
];

function DebugPanel({ warp }: { warp: number }) {
  return (
    <aside className="debug">
      <strong>Dev</strong>
      <span>Time warp +{formatIdle(warp)}</span>
      <button onClick={() => save({ timeWarpMs: warp + HOUR * 2 })}>+2 h</button>
      <button onClick={() => save({ timeWarpMs: warp + DAY })}>+1 day</button>
      <button onClick={() => save({ timeWarpMs: 0 })}>Reset time</button>
      <button onClick={() => TEST_SITES.forEach((url) => browser.tabs.create({ url, active: false }))}>Spawn test tabs</button>
      <button
        onClick={async () => {
          const { garlic } = await load();
          await browser.storage.local.clear();
          await save({ garlic });
        }}
      >
        Reset stats
      </button>
    </aside>
  );
}
