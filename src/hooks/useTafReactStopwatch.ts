import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCronometroElapsedMs, parseFormatoElapsedParaMs } from '../utils/formatRaceTime';

export type TafCronometroEstado = 'inicial' | 'rodando' | 'pausado' | 'finalizado';

/** Atualização visual ~4 Hz (MM:SS); assinantes do painel sem re-render do Aplicar. */
const DISPLAY_INTERVAL_MS = 250;
const ZERO = formatCronometroElapsedMs(0);

type Options = {
  /** Limite em ms (ex.: permanência 10 min). Null/undefined = sem limite. */
  getMaxMs?: () => number | null | undefined;
  onMaxReached?: () => void;
};

/**
 * Cronômetro TAF (MM:SS — sem centésimos na prova ativa).
 * Enquanto `rodando`, o tempo vivo vai só para `subscribeTempoExibido` —
 * o host (AplicarTAFScreen) não re-renderiza a cada tick.
 */
export function useTafReactStopwatch({ getMaxMs, onMaxReached }: Options = {}) {
  const [estado, setEstado] = useState<TafCronometroEstado>('inicial');
  /** Snapshot estável; não atualiza a cada tick em `rodando`. */
  const [tempoExibido, setTempoExibido] = useState(ZERO);
  const [pausadoTexto, setPausadoTexto] = useState(ZERO);

  const pausadoTextoRef = useRef(ZERO);
  const tempoExibidoRef = useRef(ZERO);
  const tempoParadoMsRef = useRef<number | null>(null);
  const maxReachedRef = useRef(false);
  const accumulatedMsRef = useRef(0);
  const runningSinceRef = useRef<number | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listenersRef = useRef(new Set<(fmt: string) => void>());
  const estadoRef = useRef(estado);
  const onMaxReachedRef = useRef(onMaxReached);
  const getMaxMsRef = useRef(getMaxMs);

  onMaxReachedRef.current = onMaxReached;
  getMaxMsRef.current = getMaxMs;
  estadoRef.current = estado;

  const getLiveMs = useCallback((): number => {
    if (runningSinceRef.current != null) {
      return accumulatedMsRef.current + (performance.now() - runningSinceRef.current);
    }
    return accumulatedMsRef.current;
  }, []);

  const emitFmt = useCallback((ms: number) => {
    const fmt = formatCronometroElapsedMs(ms);
    tempoExibidoRef.current = fmt;
    listenersRef.current.forEach((cb) => cb(fmt));
    return fmt;
  }, []);

  const stopTickLoop = useCallback(() => {
    if (tickTimerRef.current != null) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  const startTickLoop = useCallback(() => {
    stopTickLoop();
    tickTimerRef.current = setInterval(() => {
      if (estadoRef.current !== 'rodando') return;
      const ms = getLiveMs();
      const maxMs = getMaxMsRef.current?.() ?? null;
      if (maxMs != null && ms >= maxMs && !maxReachedRef.current) {
        maxReachedRef.current = true;
        stopTickLoop();
        runningSinceRef.current = null;
        accumulatedMsRef.current = maxMs;
        tempoParadoMsRef.current = maxMs;
        const fmt = emitFmt(maxMs);
        setPausadoTexto(fmt);
        pausadoTextoRef.current = fmt;
        setTempoExibido(fmt);
        setEstado('finalizado');
        onMaxReachedRef.current?.();
        return;
      }
      emitFmt(ms);
    }, DISPLAY_INTERVAL_MS);
  }, [emitFmt, getLiveMs, stopTickLoop]);

  useEffect(() => () => stopTickLoop(), [stopTickLoop]);

  const syncPausado = useCallback(
    (ms: number) => {
      const fmt = emitFmt(ms);
      setTempoExibido(fmt);
      setPausadoTexto(fmt);
      pausadoTextoRef.current = fmt;
      return fmt;
    },
    [emitFmt],
  );

  const resetCronometro = useCallback(() => {
    stopTickLoop();
    runningSinceRef.current = null;
    accumulatedMsRef.current = 0;
    tempoParadoMsRef.current = null;
    maxReachedRef.current = false;
    setEstado('inicial');
    syncPausado(0);
  }, [stopTickLoop, syncPausado]);

  const iniciar = useCallback(() => {
    if (estado !== 'inicial' && estado !== 'finalizado') return;
    maxReachedRef.current = false;
    tempoParadoMsRef.current = null;
    accumulatedMsRef.current = 0;
    runningSinceRef.current = performance.now();
    syncPausado(0);
    setEstado('rodando');
    startTickLoop();
  }, [estado, syncPausado, startTickLoop]);

  const pausar = useCallback(() => {
    if (estado !== 'rodando') return;
    const ms = getLiveMs();
    stopTickLoop();
    runningSinceRef.current = null;
    accumulatedMsRef.current = ms;
    syncPausado(ms);
    setEstado('pausado');
  }, [estado, getLiveMs, stopTickLoop, syncPausado]);

  const aplicarTextoPausado = useCallback((): number | null => {
    return parseFormatoElapsedParaMs(pausadoTextoRef.current.trim());
  }, []);

  const continuar = useCallback((): boolean => {
    if (estado !== 'pausado') return false;
    const ms = aplicarTextoPausado();
    if (ms == null) return false;
    maxReachedRef.current = false;
    accumulatedMsRef.current = ms;
    runningSinceRef.current = performance.now();
    syncPausado(ms);
    setEstado('rodando');
    startTickLoop();
    return true;
  }, [estado, aplicarTextoPausado, syncPausado, startTickLoop]);

  const parar = useCallback((): boolean => {
    if (estado !== 'rodando' && estado !== 'pausado') return false;
    let totalMs: number;
    if (estado === 'pausado') {
      const edited = aplicarTextoPausado();
      if (edited == null) return false;
      totalMs = edited;
    } else {
      totalMs = getLiveMs();
      stopTickLoop();
      runningSinceRef.current = null;
    }
    accumulatedMsRef.current = totalMs;
    tempoParadoMsRef.current = totalMs;
    syncPausado(totalMs);
    setEstado('finalizado');
    return true;
  }, [estado, getLiveMs, stopTickLoop, aplicarTextoPausado, syncPausado]);

  /**
   * Após encerrar por conclusão de todos (Aplicar Resultado), se o aplicador
   * desmarcar o último checklist o cronômetro volta pausado no instante final.
   */
  const reativarComoPausado = useCallback((): boolean => {
    if (estado !== 'finalizado') return false;
    const ms =
      tempoParadoMsRef.current ??
      parseFormatoElapsedParaMs(pausadoTextoRef.current.trim()) ??
      accumulatedMsRef.current;
    if (!Number.isFinite(ms) || ms < 0) return false;
    stopTickLoop();
    runningSinceRef.current = null;
    maxReachedRef.current = false;
    tempoParadoMsRef.current = null;
    accumulatedMsRef.current = ms;
    syncPausado(ms);
    setEstado('pausado');
    return true;
  }, [estado, stopTickLoop, syncPausado]);

  /** Força encerramento no limite (permanência). */
  const finalizarNoMs = useCallback(
    (ms: number) => {
      stopTickLoop();
      runningSinceRef.current = null;
      maxReachedRef.current = true;
      accumulatedMsRef.current = ms;
      tempoParadoMsRef.current = ms;
      syncPausado(ms);
      setEstado('finalizado');
    },
    [stopTickLoop, syncPausado],
  );

  const getElapsedMs = useCallback((): number | null => {
    if (estado === 'rodando') return getLiveMs();
    if (estado === 'pausado') {
      const parsed = parseFormatoElapsedParaMs(pausadoTextoRef.current.trim());
      if (parsed != null) return parsed;
      return accumulatedMsRef.current;
    }
    if (estado === 'finalizado' && tempoParadoMsRef.current != null) {
      return tempoParadoMsRef.current;
    }
    return null;
  }, [estado, getLiveMs]);

  const onPausadoTextoChange = useCallback((text: string) => {
    setPausadoTexto(text);
    pausadoTextoRef.current = text;
  }, []);

  const onBlurPausado = useCallback(() => {
    const ms = parseFormatoElapsedParaMs(pausadoTextoRef.current.trim());
    if (ms == null) {
      syncPausado(accumulatedMsRef.current);
      return;
    }
    accumulatedMsRef.current = ms;
    syncPausado(ms);
  }, [syncPausado]);

  /**
   * Restaura cronômetro a partir de sessão persistida.
   * `rodando` vira `pausado` para o aplicador confirmar continuidade com segurança.
   */
  const restaurar = useCallback(
    (opts: { estado: TafCronometroEstado; elapsedMs: number }) => {
      const ms = Math.max(0, Math.floor(opts.elapsedMs));
      stopTickLoop();
      runningSinceRef.current = null;
      maxReachedRef.current = false;

      if (opts.estado === 'inicial' || (ms <= 0 && opts.estado !== 'finalizado')) {
        accumulatedMsRef.current = 0;
        tempoParadoMsRef.current = null;
        setEstado('inicial');
        syncPausado(0);
        return;
      }

      const estadoRestored: TafCronometroEstado =
        opts.estado === 'rodando' ? 'pausado' : opts.estado;

      accumulatedMsRef.current = ms;
      syncPausado(ms);
      tempoParadoMsRef.current = estadoRestored === 'finalizado' ? ms : null;
      setEstado(estadoRestored);
    },
    [stopTickLoop, syncPausado],
  );

  const subscribeTempoExibido = useCallback((cb: (fmt: string) => void) => {
    listenersRef.current.add(cb);
    cb(tempoExibidoRef.current);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  return {
    estado,
    isRunning: estado === 'rodando',
    tempoExibido,
    subscribeTempoExibido,
    pausadoTexto,
    pausadoTextoRef,
    tempoParadoMsRef,
    resetCronometro,
    iniciar,
    pausar,
    continuar,
    parar,
    reativarComoPausado,
    finalizarNoMs,
    getElapsedMs,
    onPausadoTextoChange,
    onBlurPausado,
    aplicarTextoPausado,
    syncPausado,
    restaurar,
  };
}
