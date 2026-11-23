import { useEffect, useState } from 'react';

export type Route = 'crypt' | 'bloodbank' | 'popup';

const ROUTES: Record<string, Route> = {
  '#/crypt': 'crypt',
  '#/bloodbank': 'bloodbank',
  '#/popup': 'popup',
};

/** The three exact route hashes (one optional trailing slash) resolve. Anything else is null. */
export function resolveRoute(hash: string): Route | null {
  const key = hash.endsWith('/') && hash.length > 2 ? hash.slice(0, -1) : hash;
  return Object.hasOwn(ROUTES, key) ? (ROUTES[key] ?? null) : null;
}

/** Resolve the current hash. An unknown or empty hash is replaced by #/crypt (no history entry). */
function current(): Route {
  const route = resolveRoute(window.location.hash);
  if (route) return route;
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}#/crypt`);
  return 'crypt';
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(current);
  useEffect(() => {
    const onHash = () => setRoute(current());
    window.addEventListener('hashchange', onHash);
    onHash(); // catches a change between the first render and the listener
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
