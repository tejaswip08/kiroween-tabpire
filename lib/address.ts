// What the search box does with typed text: open it as an address, or search for it. Pure: no browser APIs.

/** A host name with a dot and a top-level part of letters (example.com, docs.google.co.uk), or localhost. */
const HOST = /^(localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(:\d{1,5})?([/?#]\S*)?$/i;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?([/?#]\S*)?$/;

/**
 * The address to open for typed text, or null when the text should be searched for. Only http and https addresses are
 * opened: "example.com" opens https://example.com/, "localhost:3000" and IP addresses open over http, anything with a
 * space or another scheme (javascript:, file:, data:) is a search.
 */
export function addressOf(text: string): string | null {
  const t = text.trim();
  if (t === '' || /\s/.test(t)) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      const url = new URL(t);
      return url.hostname ? url.href : null;
    } catch {
      return null;
    }
  }
  // Any other scheme is never opened.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t)) return null;
  const local = /^localhost(:|\/|$)/i.test(t) || IPV4.test(t);
  if (!HOST.test(t) && !IPV4.test(t)) return null;
  try {
    return new URL(`${local ? 'http' : 'https'}://${t}`).href;
  } catch {
    return null;
  }
}
