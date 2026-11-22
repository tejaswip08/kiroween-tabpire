import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUGGEST_ORIGIN, SUGGEST_TIMEOUT_MS, fetchGoogleSuggestions } from '../lib/google';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const json = (body: unknown, ok = true) => ({ ok, json: async () => body });

describe('fetchGoogleSuggestions', () => {
  it('sends only the encoded query, with no credentials or referrer', async () => {
    fetchMock.mockResolvedValue(json(['q', ['a', 'b']]));
    const result = await fetchGoogleSuggestions('cats & dogs?', new AbortController().signal);

    expect(result).toEqual(['a', 'b']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${SUGGEST_ORIGIN}/complete/search?client=firefox&q=cats%20%26%20dogs%3F`);
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('gives [] for a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect(await fetchGoogleSuggestions('x', new AbortController().signal)).toEqual([]);
  });

  it('gives [] for a bad status', async () => {
    fetchMock.mockResolvedValue(json(['q', ['a']], false));
    expect(await fetchGoogleSuggestions('x', new AbortController().signal)).toEqual([]);
  });

  it('gives [] for bad JSON or a wrong shape', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad'); } });
    expect(await fetchGoogleSuggestions('x', new AbortController().signal)).toEqual([]);
    fetchMock.mockResolvedValue(json({ not: 'an array' }));
    expect(await fetchGoogleSuggestions('x', new AbortController().signal)).toEqual([]);
  });

  it('does not call fetch when already aborted', async () => {
    const c = new AbortController();
    c.abort();
    expect(await fetchGoogleSuggestions('x', c.signal)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts the request when the caller aborts', async () => {
    let seen: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, init) => {
      seen = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const c = new AbortController();
    const pending = fetchGoogleSuggestions('x', c.signal);
    c.abort();
    expect(await pending).toEqual([]);
    expect(seen?.aborted).toBe(true);
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    );
    const pending = fetchGoogleSuggestions('x', new AbortController().signal);
    await vi.advanceTimersByTimeAsync(SUGGEST_TIMEOUT_MS + 10);
    expect(await pending).toEqual([]);
  });
});
