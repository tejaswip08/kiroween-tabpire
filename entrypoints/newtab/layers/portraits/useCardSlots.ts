import { useEffect, useState } from 'react';
import type { VampireState } from '../../../../lib/hunger';
import type { ExitKind } from '../../../../lib/scene/exitKinds';

export interface CardSlot {
  id: number;
  /** The 96 x 112 portrait slot the vampire is drawn over. */
  el: HTMLElement;
  state: VampireState;
  /** Set while the card is leaving: which action closed its tab. */
  exitKind?: ExitKind;
  /** How long the card stays while it leaves. */
  exitMs: number;
}

const signature = (s: CardSlot[]) => s.map((c) => `${c.id}|${c.state}|${c.exitKind ?? ''}|${c.exitMs}`).join(',');

/**
 * Finds the portrait slot of every card that is on or near the screen. The page owns the
 * cards, so this reads them from the page: it watches for cards added, removed or changed,
 * and uses an IntersectionObserver with a margin of one screen, so a page with hundreds of
 * tabs keeps only a few live views.
 */
export function useCardSlots(): CardSlot[] {
  const [slots, setSlots] = useState<CardSlot[]>([]);

  useEffect(() => {
    const near = new Set<Element>();
    const observed = new Set<Element>();
    let last = '';
    let frame = 0;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) near.add(e.target);
          else near.delete(e.target);
        }
        schedule();
      },
      { rootMargin: '100% 0px 100% 0px' },
    );

    function scan() {
      frame = 0;
      const seen = new Set<Element>();
      const next: CardSlot[] = [];
      for (const card of document.querySelectorAll<HTMLElement>('.card[data-tab-id]')) {
        const el = card.querySelector<HTMLElement>('[data-portrait-slot]');
        if (!el) continue;
        seen.add(el);
        if (!observed.has(el)) {
          observed.add(el);
          io.observe(el);
        }
        if (!near.has(el)) continue;
        const exitKind = card.dataset['exit'] as ExitKind | undefined;
        next.push({
          id: Number(card.dataset['tabId']),
          el,
          state: (card.dataset['state'] as VampireState) ?? 'awake',
          exitKind,
          exitMs: Number.parseFloat(card.style.getPropertyValue('--exit-ms')) || 0,
        });
      }
      for (const el of [...observed]) {
        if (!seen.has(el)) {
          observed.delete(el);
          near.delete(el);
          io.unobserve(el);
        }
      }
      const sig = signature(next);
      if (sig !== last) {
        last = sig;
        setSlots(next);
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(scan);
    }

    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'data-exit'] });
    schedule();
    return () => {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return slots;
}
