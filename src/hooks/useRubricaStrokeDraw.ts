import { useCallback, useEffect, useRef, useState } from 'react';
import type { RubricaPoint, RubricaStroke } from '../utils/rubricaSvgBuilder';

/** Distância mínima² entre pontos (~1.5 px) para reduzir amostras sem perder o traço. */
export const RUBRICA_STROKE_MIN_DIST_SQ = 2.25;

export function shouldAppendRubricaPoint(
  last: RubricaPoint | null,
  x: number,
  y: number,
  minDistSq: number = RUBRICA_STROKE_MIN_DIST_SQ,
): boolean {
  if (!last) return true;
  const dx = x - last.x;
  const dy = y - last.y;
  return dx * dx + dy * dy >= minDistSq;
}

/**
 * Traço de rúbrica com pontos em ref + no máximo 1 setState por frame (rAF).
 * Evita re-render a cada evento de ponteiro.
 */
export function useRubricaStrokeDraw() {
  const [strokes, setStrokes] = useState<RubricaStroke[]>([]);
  const [strokeAtual, setStrokeAtual] = useState<RubricaStroke>([]);
  const strokesRef = useRef<RubricaStroke[]>([]);
  const strokeAtualRef = useRef<RubricaStroke>([]);
  const lastPointRef = useRef<RubricaPoint | null>(null);
  const dirtyRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const cancelRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const flushStrokeToState = useCallback(() => {
    rafRef.current = null;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setStrokeAtual(strokeAtualRef.current.slice());
  }, []);

  const scheduleFlush = useCallback(() => {
    dirtyRef.current = true;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flushStrokeToState);
  }, [flushStrokeToState]);

  useEffect(() => () => cancelRaf(), [cancelRaf]);

  const iniciar = useCallback(
    (x: number, y: number) => {
      cancelRaf();
      dirtyRef.current = false;
      const pt: RubricaPoint = { x, y };
      strokeAtualRef.current = [pt];
      lastPointRef.current = pt;
      setStrokeAtual([pt]);
    },
    [cancelRaf],
  );

  const mover = useCallback(
    (x: number, y: number) => {
      if (!shouldAppendRubricaPoint(lastPointRef.current, x, y)) return;
      const pt: RubricaPoint = { x, y };
      strokeAtualRef.current.push(pt);
      lastPointRef.current = pt;
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const finalizar = useCallback(() => {
    cancelRaf();
    dirtyRef.current = false;
    const current = strokeAtualRef.current;
    if (current.length === 0) return;
    const committed = current.slice();
    strokeAtualRef.current = [];
    lastPointRef.current = null;
    setStrokes((prev) => {
      const next = [...prev, committed];
      strokesRef.current = next;
      return next;
    });
    setStrokeAtual([]);
  }, [cancelRaf]);

  const limpar = useCallback(() => {
    cancelRaf();
    dirtyRef.current = false;
    strokeAtualRef.current = [];
    lastPointRef.current = null;
    strokesRef.current = [];
    setStrokes([]);
    setStrokeAtual([]);
  }, [cancelRaf]);

  /** Snapshot estável para confirmar/salvar (inclui pontos ainda não flushados no estado). */
  const getTodosStrokes = useCallback((): RubricaStroke[] => {
    cancelRaf();
    dirtyRef.current = false;
    const atual = strokeAtualRef.current;
    return [
      ...strokesRef.current.filter((s) => s.length > 0),
      ...(atual.length > 0 ? [atual.slice()] : []),
    ];
  }, [cancelRaf]);

  const temTraco =
    strokes.some((s) => s.length > 0) || strokeAtual.length > 0 || strokeAtualRef.current.length > 0;

  return {
    strokes,
    strokeAtual,
    temTraco,
    iniciar,
    mover,
    finalizar,
    limpar,
    getTodosStrokes,
  };
}
