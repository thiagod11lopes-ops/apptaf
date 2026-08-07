import { Platform } from 'react-native';
import { runAfterFirstPaint } from './runAfterFirstPaint';

/** Cede a thread para a UI respirar entre lotes de trabalho pesado. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Cede a UI de forma mais forte (macrotask + frame) entre itens pesados de um lote.
 * Preferível no raster em série de rúbricas enquanto o aplicador assina.
 */
export async function yieldToUiHeavy(): Promise<void> {
  await yieldToUi();
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

/**
 * Chama `yieldFn` a cada `n` itens processados (1-based count).
 * Com `n <= 1`, yield em todo item.
 */
export async function yieldEveryN(
  itensProcessados: number,
  n: number,
  yieldFn: () => Promise<void> = yieldToUiHeavy,
): Promise<void> {
  const passo = Math.max(1, Math.floor(n) || 1);
  if (itensProcessados > 0 && itensProcessados % passo === 0) {
    await yieldFn();
  }
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
