import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitSceneEvent, onSceneEvent, type SceneEvent } from '../lib/scene/bus';
import { clearMarks, markExit, markTransition, takeExit, takeTransition } from '../lib/scene/exitKinds';

beforeEach(() => clearMarks());

describe('exit marks', () => {
  it('are taken once', () => {
    markExit(7, 'stake', 0, 1000);
    expect(takeExit(7, 1500)).toMatchObject({ kind: 'stake', order: 0 });
    expect(takeExit(7, 1500)).toBeUndefined();
  });
  it('expire', () => {
    markExit(1, 'crypt', 0, 0);
    expect(takeExit(1, 10_001)).toBeUndefined();
    markExit(2, 'crypt', 0, 0);
    expect(takeExit(2, 10_000)).toBeDefined();
  });
  it('keep the Dawn order for each card', () => {
    [11, 12, 13].forEach((id, i) => markExit(id, 'dawn', i, 5));
    expect([13, 11, 12].map((id) => takeExit(id, 6)?.order)).toEqual([2, 0, 1]);
  });
  it('return nothing for an unmarked tab', () => {
    expect(takeExit(99)).toBeUndefined();
    expect(takeTransition(99)).toBeUndefined();
  });
  it('keep transitions apart from exits, taken once and expiring', () => {
    markTransition(4, 'coffin', 0);
    expect(takeExit(4, 1)).toBeUndefined();
    expect(takeTransition(4, 1)).toBe('coffin');
    expect(takeTransition(4, 1)).toBeUndefined();
    markTransition(5, 'coffin', 0);
    expect(takeTransition(5, 20_000)).toBeUndefined();
  });
});

describe('scene bus', () => {
  it('delivers events to every listener until it unsubscribes', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onSceneEvent(a);
    onSceneEvent(b)();
    const e: SceneEvent = { type: 'dawn', closed: 3 };
    emitSceneEvent(e);
    offA();
    emitSceneEvent({ type: 'stake' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(e);
    expect(b).not.toHaveBeenCalled();
  });
  it('lets a listener unsubscribe while an event is delivered', () => {
    const calls: string[] = [];
    const off = onSceneEvent(() => { calls.push('one'); off(); });
    const off2 = onSceneEvent(() => calls.push('two'));
    emitSceneEvent({ type: 'crypt' });
    emitSceneEvent({ type: 'crypt' });
    off2();
    expect(calls).toEqual(['one', 'two', 'two']);
  });
});
