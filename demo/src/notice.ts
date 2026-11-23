// A tiny event emitter for demo notices. Memory only: nothing is stored or sent.

export interface DemoNotice {
  id: number;
  text: string;
}

type Listener = (notice: DemoNotice) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** Raises a notice for every subscriber. */
export function notify(text: string): DemoNotice {
  const notice = { id: nextId++, text };
  for (const l of [...listeners]) l(notice);
  return notice;
}

/** Subscribes to notices. Returns the unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
