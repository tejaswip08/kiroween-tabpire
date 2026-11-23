import { useCallback, useMemo, useRef, useState } from 'react';
import { dawnTargets, type VampireState } from '../../lib/hunger';
import { filterByState, toggleFilter } from '../../lib/legend';
import { emitSceneEvent } from '../../lib/scene/bus';
import { actionNotice, dawnNotice, resurrectNotice } from '../../lib/messages';
import { openInThisTab, searchWithDefaultEngine, showTab } from '../../lib/nav';
import type { Suggestion } from '../../lib/suggest';
import { coffin, crypt, dawn, garlic, resurrect, stake, ungarlic, type ActionResult } from '../../lib/tabs';
import type { SceneInputs } from '../../lib/scene/meaning';
import { sumMb, type Card } from '../../lib/view';
import { CardGrid } from './components/CardGrid';
import { CardSkeleton } from './components/CardSkeleton';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { Header } from './components/Header';
import { Haunts, originOf } from './Haunts';
import { SearchBox } from './components/SearchBox';
import { StateLegend } from './components/StateLegend';
import { cardTitle, type CardAction } from './components/TabCard';
import { Toasts } from './components/Toasts';
import { announceAction, markActionExit, markDawnExits } from './hooks/exitMarks';
import { useCrypt } from './components/useCrypt';
import { prefersReducedMotion } from './hooks/useExitingCards';
import { useToasts } from './hooks/useToasts';
import { FpsReadout } from './layers/FpsReadout';
import { PortraitLayerHost, SceneLayerHost } from './layers/hosts';

async function runCardAction(card: Card, action: CardAction): Promise<ActionResult> {
  const id = card.tab.id;
  switch (action) {
    case 'stake':
      return stake(id);
    case 'coffin':
      return coffin(id);
    case 'crypt':
      return crypt(id);
    case 'garlic':
      return garlic(id);
    case 'ungarlic':
      return card.site ? ungarlic(card.site) : { ok: false, reason: 'no-site' };
  }
}

export function App() {
  const data = useCrypt();
  const { toasts, push, dismiss } = useToasts();
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());
  const [dawnBusy, setDawnBusy] = useState(false);
  const [filter, setFilter] = useState<VampireState | null>(null);
  const running = useRef(new Set<number>());
  const dawnRunning = useRef(false);
  const { reload } = data;

  const onAction = useCallback(
    async (card: Card, action: CardAction) => {
      const id = card.tab.id;
      if (running.current.has(id) || dawnRunning.current) return;
      running.current.add(id);
      setBusyIds(new Set(running.current));
      const undoMark = markActionExit(action, id, prefersReducedMotion());
      let ok = false;
      try {
        const result = await runCardAction(card, action);
        ok = result.ok;
        if (ok) announceAction(action);
        push(actionNotice(action, result, { title: cardTitle(card), site: card.site }));
      } finally {
        if (!ok) undoMark();
        running.current.delete(id);
        setBusyIds(new Set(running.current));
        reload();
      }
    },
    [push, reload],
  );

  const onSearch = useCallback(
    (text: string) => {
      searchWithDefaultEngine(text).catch(() =>
        push({ kind: 'error', text: 'The browser could not start that search.' }),
      );
    },
    [push],
  );

  const onChoose = useCallback(
    async (s: Suggestion) => {
      try {
        switch (s.kind) {
          case 'tab':
            if (s.tabId !== undefined) await showTab({ id: s.tabId, windowId: s.windowId ?? -1 });
            break;
          case 'haunt':
            if (s.url) await openInThisTab(s.url);
            break;
          case 'crypt': {
            if (!s.cryptId) break;
            const result = await resurrect(s.cryptId, Date.now(), { activate: true });
            push(resurrectNotice(result, s.label));
            if (result.ok) reload();
            break;
          }
          case 'search':
            if (s.text) await searchWithDefaultEngine(s.text);
            break;
        }
      } catch {
        push({ kind: 'error', text: 'The browser could not open that. Nothing was changed.' });
      }
    },
    [push, reload],
  );

  // The icon of an open tab on each site, so a haunt can use it first.
  const tabIcons = useMemo(() => {
    const icons: Record<string, string> = {};
    for (const t of data.rawTabs) if (t.url && t.favIconUrl && !(originOf(t.url) in icons)) icons[originOf(t.url)] = t.favIconUrl;
    return icons;
  }, [data.rawTabs]);
  const shownCards = useMemo(() => filterByState(data.cards, filter), [data.cards, filter]);
  const dawnCount = dawnTargets(
    data.cards.map((c) => c.info),
    data.garlic,
    data.now,
  ).length;

  const onDawn = useCallback(async () => {
    if (dawnRunning.current) return;
    dawnRunning.current = true;
    setDawnBusy(true);
    const marks = markDawnExits(data.cards, data.garlic, Date.now(), prefersReducedMotion());
    let ok = false;
    try {
      const result = await dawn();
      ok = result.ok;
      if (result.ok) emitSceneEvent({ type: 'dawn', closed: result.closed });
      push(dawnNotice(result));
    } finally {
      if (!ok) marks.undo();
      dawnRunning.current = false;
      setDawnBusy(false);
      reload();
    }
  }, [push, reload, data.cards, data.garlic]);

  const sceneInputs = useMemo<SceneInputs>(
    () => ({
      cardCount: data.cards.length,
      starvingCount: data.cards.filter((c) => c.state === 'starving').length,
      estimatedMb: sumMb(data.cards),
      cryptCount: data.crypt.length,
      crypted: data.stats.crypted,
      garlicCount: data.garlic.length,
      staked: data.stats.staked,
      coffined: data.stats.coffined,
      dawnReady: dawnCount > 0,
    }),
    [data.cards, data.crypt.length, data.stats, data.garlic.length, dawnCount],
  );

  return (
    <>
      <PortraitLayerHost />
      <SceneLayerHost inputs={sceneInputs} />
      <div className="page">
        <Header
          vampires={data.cards.length}
          starving={data.cards.filter((c) => c.state === 'starving').length}
          estimatedMb={sumMb(data.cards)}
          reclaimedMb={data.stats.mbFreed}
          staked={data.stats.staked}
          coffined={data.stats.coffined}
          dawnCount={dawnCount}
          dawnBusy={dawnBusy}
          onDawn={onDawn}
        />
        <main className="main">
          <SearchBox
            sources={{ tabs: data.cards.map((c) => c.tab), haunts: data.haunts, crypt: data.crypt }}
            onSearch={onSearch}
            onChoose={onChoose}
          />
          <Haunts pages={data.haunts} tabIcons={tabIcons} />
          {data.status === 'ready' && data.cards.length > 0 && (
            <StateLegend cards={data.cards} filter={filter} onToggle={(s) => setFilter((f) => toggleFilter(f, s))} />
          )}
          {data.status === 'loading' && <CardSkeleton />}
          {data.status === 'error' && <ErrorState onRetry={reload} />}
          {data.status === 'ready' &&
            (data.cards.length === 0 ? (
              <EmptyState />
            ) : shownCards.length === 0 ? (
              <p className="legend-empty">No vampires are {filter} right now.</p>
            ) : (
              <CardGrid cards={shownCards} busyIds={busyIds} allBusy={dawnBusy} onAction={onAction} />
            ))}
        </main>
        <Toasts toasts={toasts} onDismiss={dismiss} />
      </div>
      <FpsReadout />
    </>
  );
}
