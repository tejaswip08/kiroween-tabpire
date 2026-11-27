import { useCallback, useEffect, useRef, useState } from 'react';
import { KEYS, onStoreChange, store } from '../../../lib/store';

/**
 * "Hide tabs": whether the cards are tucked away so the whole 3D scene shows. Saved in storage like the theme, so it
 * stays after a reload, and follows changes made on other Tabpire pages.
 */
export function useCardsHidden(): { hidden: boolean; toggle: () => void } {
  const [hidden, setHidden] = useState(false);
  const current = useRef(hidden);
  current.current = hidden;
  const choice = useRef(0);
  useEffect(() => {
    let live = true;
    const startedAt = choice.current;
    void store.getCardsHidden().then((v) => {
      if (live && choice.current === startedAt) setHidden(v);
    });
    const unsubscribe = onStoreChange((keys) => {
      if (!keys.includes(KEYS.cardsHidden)) return;
      void store.getCardsHidden().then((v) => {
        if (live) setHidden(v);
      });
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  const toggle = useCallback(() => {
    choice.current++;
    const next = !current.current;
    current.current = next;
    setHidden(next);
    // A failed write only loses the memory of the choice; the page still switches.
    store.setCardsHidden(next).catch(() => undefined);
  }, []);
  return { hidden, toggle };
}
