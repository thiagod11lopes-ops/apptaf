/**
 * Debounce trailing simples (não leading).
 * Útil para recargas pós-mutação / pós-sync sem tempestade de I/O.
 */
export function createTrailingDebounce(delayMs: number): {
  schedule: (fn: () => void) => void;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(fn) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, delayMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
