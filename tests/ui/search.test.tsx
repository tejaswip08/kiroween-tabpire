// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchGoogle = vi.hoisted(() => vi.fn());
vi.mock('../../lib/google', () => ({ fetchGoogleSuggestions: fetchGoogle }));

import { SearchBox } from '../../entrypoints/newtab/components/SearchBox';
import { WEB_DEBOUNCE_MS } from '../../entrypoints/newtab/hooks/useSuggestions';
import type { Suggestion } from '../../lib/suggest';
import type { RawTab } from '../../lib/view';

const tab = (id: number, title: string, url: string): RawTab => ({
  id,
  windowId: 3,
  title,
  url,
  active: false,
  audible: false,
  discarded: false,
  pinned: false,
});

const sources = {
  tabs: [tab(1, 'Cat videos', 'https://video.example/cats'), tab(2, 'Weather', 'https://weather.example/')],
  pinned: [{ url: 'https://catpics.example/', title: 'Cat pics' }],
  crypt: [{ id: 'c1', url: 'https://old.example/cat', title: 'Old cat story', savedAt: 1 }],
};

const setup = () => {
  const onSearch = vi.fn();
  const onChoose = vi.fn<(s: Suggestion) => void>();
  render(<SearchBox sources={sources} onSearch={onSearch} onChoose={onChoose} />);
  const input = screen.getByRole('combobox') as HTMLInputElement;
  return { onSearch, onChoose, input };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  fetchGoogle.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe('local suggestions', () => {
  it('appear on the same keystroke, tabs then pinned then crypt, with kind labels', async () => {
    const { input } = setup();
    await userEvent.type(input, 'c');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.querySelector('.suggestion-kind')?.textContent)).toEqual([
      'Open tab',
      'Pinned page',
      'Crypt',
    ]);
    expect(options[0]?.textContent).toContain('Cat videos');
    expect(fetchGoogle).not.toHaveBeenCalled();
  });

  it('show nothing for text that matches nothing, and keep the list closed', async () => {
    const { input } = setup();
    await userEvent.type(input, 'zzzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('web suggestions', () => {
  it('are asked for only after a pause, and only from 2 characters', async () => {
    const { input } = setup();
    await userEvent.type(input, 'c');
    await sleep(WEB_DEBOUNCE_MS + 100);
    expect(fetchGoogle).not.toHaveBeenCalled();

    await userEvent.type(input, 'a');
    expect(fetchGoogle).not.toHaveBeenCalled(); // not yet: still within the pause
    await waitFor(() => expect(fetchGoogle).toHaveBeenCalledTimes(1));
    expect(fetchGoogle.mock.calls[0]?.[0]).toBe('ca');
  });

  it('are sent only as the typed text, and show after the local ones', async () => {
    fetchGoogle.mockResolvedValue(['cat food', 'cat names']);
    const { input } = setup();
    await userEvent.type(input, 'cat');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(5));
    const kinds = screen.getAllByRole('option').map((o) => o.getAttribute('data-kind'));
    expect(kinds).toEqual(['tab', 'pinned', 'crypt', 'search', 'search']);
    expect(fetchGoogle.mock.calls.every((c) => c[0] === 'cat' || c[0] === 'ca')).toBe(true);
    expect(fetchGoogle.mock.calls.flat().filter((x) => typeof x === 'string').join(' ')).not.toContain('example');
  });

  it('cancel an older request when the text changes', async () => {
    const signals: AbortSignal[] = [];
    fetchGoogle.mockImplementation((_q: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    const { input } = setup();
    await userEvent.type(input, 'ab');
    await waitFor(() => expect(signals).toHaveLength(1));
    await userEvent.type(input, 'c');
    expect(signals[0]?.aborted).toBe(true);
  });

  it('never show results for older text', async () => {
    let resolveFirst!: (v: string[]) => void;
    fetchGoogle
      .mockImplementationOnce(() => new Promise<string[]>((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(['dogs']);
    const { input } = setup();
    await userEvent.type(input, 'ab');
    await waitFor(() => expect(fetchGoogle).toHaveBeenCalledTimes(1));
    await userEvent.type(input, 'c');
    await waitFor(() => expect(screen.getAllByRole('option').some((o) => o.textContent?.includes('dogs'))).toBe(true));
    resolveFirst(['stale']);
    await sleep(30);
    expect(screen.queryByText('stale')).toBeNull();
  });

  it('leave local suggestions and show no error when the request fails', async () => {
    fetchGoogle.mockResolvedValue([]);
    const { input } = setup();
    await userEvent.type(input, 'cat');
    await waitFor(() => expect(fetchGoogle).toHaveBeenCalled());
    await sleep(30);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('keyboard', () => {
  it('moves with the arrow keys and wraps', async () => {
    const { input } = setup();
    await userEvent.type(input, 'cat');
    const options = screen.getAllByRole('option');
    await userEvent.keyboard('{ArrowDown}');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard('{ArrowUp}');
    expect(options[2]?.getAttribute('aria-selected')).toBe('true');
  });

  it('chooses the highlighted suggestion with Enter, and clears the box', async () => {
    const { input, onChoose, onSearch } = setup();
    await userEvent.type(input, 'cat');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.calls[0]![0]).toMatchObject({ kind: 'tab', tabId: 1, windowId: 3 });
    expect(onSearch).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('searches the typed text with Enter when nothing is highlighted', async () => {
    const { input, onChoose, onSearch } = setup();
    await userEvent.type(input, '  cute bats ');
    await userEvent.keyboard('{Enter}');
    expect(onSearch).toHaveBeenCalledWith('cute bats');
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('does nothing for Enter on an empty box', async () => {
    const { input, onSearch } = setup();
    input.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('closes the list with Escape and keeps the text', async () => {
    const { input } = setup();
    await userEvent.type(input, 'cat');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{Escape}');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('cat');
    expect(screen.getByRole('listbox', { hidden: true }).hasAttribute('hidden')).toBe(true);
  });

  it('reopens with the arrow keys after Escape', async () => {
    const { input } = setup();
    await userEvent.type(input, 'cat');
    await userEvent.keyboard('{Escape}{ArrowDown}');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('mouse and each kind', () => {
  it('choosing each kind passes the information needed to act on it', async () => {
    fetchGoogle.mockResolvedValue(['cat food']);
    const { input, onChoose } = setup();
    await userEvent.type(input, 'cat');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    for (const kind of ['tab', 'pinned', 'crypt', 'search']) {
      const option = screen.getAllByRole('option').find((o) => o.getAttribute('data-kind') === kind)!;
      await userEvent.click(option);
      await userEvent.type(input, 'cat');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(4));
    }
    const chosen = onChoose.mock.calls.map((c) => c[0]);
    expect(chosen[0]).toMatchObject({ kind: 'tab', tabId: 1 });
    expect(chosen[1]).toMatchObject({ kind: 'pinned', url: 'https://catpics.example/' });
    expect(chosen[2]).toMatchObject({ kind: 'crypt', cryptId: 'c1' });
    expect(chosen[3]).toMatchObject({ kind: 'search', text: 'cat food' });
  });

  it('highlights on hover', async () => {
    const { input } = setup();
    await userEvent.type(input, 'cat');
    const options = screen.getAllByRole('option');
    await userEvent.hover(options[1]!);
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('accessibility', () => {
  it('follows the combobox pattern', async () => {
    const { input } = setup();
    const search = screen.getByRole('search');
    expect(within(search).getByLabelText('Search the web or your tabs')).toBe(input);
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    const listbox = screen.getByRole('listbox', { hidden: true });
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    await userEvent.type(input, 'cat');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('3 suggestions');
  });
});
