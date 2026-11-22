import { useCallback, useEffect, useRef, useState } from 'react';
import type { Notice } from '../../../lib/messages';

export const MAX_TOASTS = 3;
export const OK_MS = 5000;
export const ERROR_MS = 8000;

export interface Toast extends Notice {
  id: number;
}

/** A short queue of messages. Each goes away by itself. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (notice: Notice) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { ...notice, id }].slice(-MAX_TOASTS));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), notice.kind === 'error' ? ERROR_MS : OK_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const t of active.values()) clearTimeout(t);
      active.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}
