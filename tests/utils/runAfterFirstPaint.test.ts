import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  InteractionManager: {
    runAfterInteractions: (task: () => void) => {
      task();
      return { cancel: () => {} };
    },
  },
}));

import { runAfterFirstPaint } from '../../src/utils/runAfterFirstPaint';

describe('runAfterFirstPaint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('agenda no próximo paint (double rAF) e cancela', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      callbacks[id - 1] = () => {};
    });

    const task = vi.fn();
    const cancel = runAfterFirstPaint(task);
    expect(task).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);

    callbacks[0](0);
    expect(callbacks).toHaveLength(2);
    expect(task).not.toHaveBeenCalled();

    cancel();
    callbacks[1](0);
    expect(task).not.toHaveBeenCalled();
  });

  it('executa após o segundo rAF', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const task = vi.fn();
    runAfterFirstPaint(task);
    callbacks[0](0);
    callbacks[1](0);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
