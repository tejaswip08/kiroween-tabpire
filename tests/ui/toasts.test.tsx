// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from '../../entrypoints/newtab/components/Toasts';
import { ERROR_MS, MAX_TOASTS, OK_MS, useToasts } from '../../entrypoints/newtab/hooks/useToasts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useToasts', () => {
  it('removes a message after its time, errors later than others', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ kind: 'ok', text: 'fine' });
      result.current.push({ kind: 'error', text: 'bad' });
    });
    expect(result.current.toasts).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(OK_MS + 1));
    expect(result.current.toasts.map((t) => t.text)).toEqual(['bad']);
    act(() => void vi.advanceTimersByTime(ERROR_MS - OK_MS + 1));
    expect(result.current.toasts).toEqual([]);
  });

  it('keeps at most three, newest last', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      for (let i = 1; i <= 5; i++) result.current.push({ kind: 'ok', text: `m${i}` });
    });
    expect(result.current.toasts.map((t) => t.text)).toEqual(['m3', 'm4', 'm5']);
    expect(MAX_TOASTS).toBe(3);
  });

  it('can dismiss a message', () => {
    const { result } = renderHook(() => useToasts());
    act(() => result.current.push({ kind: 'ok', text: 'x' }));
    act(() => result.current.dismiss(result.current.toasts[0]!.id));
    expect(result.current.toasts).toEqual([]);
  });
});

describe('Toasts', () => {
  it('announces errors as alerts and other messages as status', () => {
    render(
      <Toasts
        toasts={[
          { id: 1, kind: 'ok', text: 'All good' },
          { id: 2, kind: 'error', text: 'Went wrong' },
        ]}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('All good');
    expect(screen.getByRole('alert').textContent).toContain('Went wrong');
  });

  it('has a dismiss button', async () => {
    vi.useRealTimers();
    const onDismiss = vi.fn();
    render(<Toasts toasts={[{ id: 7, kind: 'ok', text: 'Hi' }]} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(onDismiss).toHaveBeenCalledWith(7);
  });
});
