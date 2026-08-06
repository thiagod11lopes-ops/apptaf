import { Platform } from 'react-native';
import { runAfterFirstPaint } from './runAfterFirstPaint';

/** Cede a thread para a UI respirar entre lotes de trabalho pesado. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Agenda tarefa quando o browser está ocioso (PWA/web).
 * Fallback: após o primeiro paint / interações.
 */
export function runWhenIdle(task: () => void, timeoutMs = 1200): () => void {
  if (
    Platform.OS === 'web' &&
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback === 'function'
  ) {
    const ric = (globalThis as unknown as {
      requestIdleCallback: typeof requestIdleCallback;
      cancelIdleCallback: typeof cancelIdleCallback;
    }).requestIdleCallback;
    const cic = (globalThis as unknown as {
      cancelIdleCallback: typeof cancelIdleCallback;
    }).cancelIdleCallback;
    const id = ric(() => task(), { timeout: timeoutMs });
    return () => cic(id);
  }
  return runAfterFirstPaint(task);
}
