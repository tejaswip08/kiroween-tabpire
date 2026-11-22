import { useCallback, useRef, useState } from 'react';
import { dawnTargets } from '../../lib/hunger';
import { actionNotice, dawnNotice, resurrectNotice } from '../../lib/messages';
import { openInThisTab, searchWithDefaultEngine, showTab } from '../../lib/nav';
import type { Suggestion } from '../../lib/suggest';
import { coffin, crypt, dawn, garlic, resurrect, stake, ungarlic, type ActionResult } from '../../lib/tabs';
import { sumMb, type Card } from '../../lib/view';
import { CardGrid } from './components/CardGrid';
import { CardSkeleton } from './components/CardSkeleton';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { Header } from './components/Header';
import { PinnedRow } from './components/PinnedRow';
import { SearchBox } from './components/SearchBox';
import { cardTitle, type CardAction } from './components/TabCard';
import { Toasts } from './components/Toasts';
import { useCryptData } from './hooks/useCryptData';
import { useToasts } from './hooks/useToasts';

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
  const data = useCryptData();
  const { toasts, push, dismiss } = useToasts();
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());
  const [dawnBusy, setDawnBusy] = useState(false);
  const running = useRef(new Set<number>());
  const dawnRunning = useRef(false);
  const { reload } = data;

  const onAction = useCallback(
    async (card: Card, action: CardAction) => {
      const id = card.tab.id;
      if (running.current.has(id) || dawnRunning.current) return;
      running.current.add(id);
      setBusyIds(new Set(running.current));
      try {
        const result = await runCardAction(card, action);
        push(actionNotice(action, result, { title: cardTitle(card), site: card.site }));
      } finally {
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
          case 'pinned':
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

  const dawnCount = dawnTargets(
    data.cards.map((c) => c.info),
    data.garlic,
    data.now,
  ).length;

  const onDawn = useCallback(async () => {
    if (dawnRunning.current) return;
    dawnRunning.current = true;
    setDawnBusy(true);
    try {
      push(dawnNotice(await dawn()));
    } finally {
      dawnRunning.current = false;
      setDawnBusy(false);
      reload();
    }
  }, [push, reload]);

  return (
    <div className="page">
      <Header
        openTabs={data.cards.length}
        estimatedMb={sumMb(data.cards)}
        reclaimedMb={data.stats.mbFreed}
        dawnCount={dawnCount}
        dawnBusy={dawnBusy}
        onDawn={onDawn}
      />
      <main className="main">
        <SearchBox
          sources={{ tabs: data.cards.map((c) => c.tab), pinned: data.pinned, crypt: data.crypt }}
          onSearch={onSearch}
          onChoose={onChoose}
        />
        <PinnedRow pages={data.pinned} />
        {data.status === 'loading' && <CardSkeleton />}
        {data.status === 'error' && <ErrorState onRetry={reload} />}
        {data.status === 'ready' &&
          (data.cards.length === 0 ? (
            <EmptyState />
          ) : (
            <CardGrid cards={data.cards} busyIds={busyIds} allBusy={dawnBusy} onAction={onAction} />
          ))}
      </main>
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
