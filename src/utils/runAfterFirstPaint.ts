import { InteractionManager, Platform } from 'react-native';

/**
 * Agenda trabalho pesado para depois do primeiro paint / interações.
 * Web: double rAF. Native: InteractionManager.
 */
export function runAfterFirstPaint(task: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (!cancelled) task();
  };

  if (Platform.OS === 'web' && typeof requestAnimationFrame === 'function') {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(run);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }

  const handle = InteractionManager.runAfterInteractions(run);
  return () => {
    cancelled = true;
    handle.cancel();
  };
}
