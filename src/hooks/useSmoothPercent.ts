import { useEffect, useState } from 'react';

/** Anima suavemente o valor exibido em direção ao percentual real. */
export function useSmoothPercent(target: number, active: boolean): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active) {
      setDisplay(target >= 100 ? 100 : 0);
      return;
    }

    const timer = setInterval(() => {
      setDisplay((prev) => {
        if (prev < target) return Math.min(target, prev + 2);
        if (prev > target) return Math.max(target, prev - 1);
        return prev;
      });
    }, 36);

    return () => clearInterval(timer);
  }, [active, target]);

  return display;
}
