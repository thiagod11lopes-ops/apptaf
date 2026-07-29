import { useCallback, useEffect, useRef, useState } from 'react';
import { useStopwatch } from 'react-timer-hook';
import {
  formatElapsedMs,
  parseFormatoElapsedParaMs,
  stopwatchOffsetFromElapsedMs,
} from '../utils/formatRaceTime';

export type TafCronometroEstado = 'inicial' | 'rodando' | 'pausado' | 'finalizado';

const TICK_MS = 10;
const ZERO = formatElapsedMs(0);

type Options = {
  /** Limite em ms (ex.: permanência 10 min). Null/undefined = sem limite. */
  getMaxMs?: () => number | null | undefined;
  onMaxReached?: () => void;
};

/**
 * Cronômetro TAF baseado em `react-timer-hook` (MM:SS:CS).
 */
export function useTafReactStopwatch({ getMaxMs, onMaxReached }: Options = {}) {
  const {
    totalMilliseconds,
    isRunning,
    start,
    pause,
    reset,
  } = useStopwatch({ autoStart: false, interval: TICK_MS });

  const [estado, setEstado] = useState<TafCronometroEstado>('inicial');
  const [tempoExibido, setTempoExibido] = useState(ZERO);
  const [pausadoTexto, setPausadoTexto] = useState(ZERO);
  const pausadoTextoRef = useRef(ZERO);
  const tempoParadoMsRef = useRef<number | null>(null);
  const maxReachedRef = useRef(false);
  const onMaxReachedRef = useRef(onMaxReached);
  const getMaxMsRef = useRef(getMaxMs);
  onMaxReachedRef.current = onMaxReached;
  getMaxMsRef.current = getMaxMs;

  const elapsedLiveMs = totalMilliseconds;

  useEffect(() => {
    if (estado !== 'rodando') return;
    const maxMs = getMaxMsRef.current?.() ?? null;
    if (maxMs != null && elapsedLiveMs >= maxMs && !maxReachedRef.current) {
      maxReachedRef.current = true;
      pause();
      tempoParadoMsRef.current = maxMs;
      const fmt = formatElapsedMs(maxMs);
      setTempoExibido(fmt);
      setPausadoTexto(fmt);
      pausadoTextoRef.current = fmt;
      setEstado('finalizado');
      onMaxReachedRef.current?.();
      return;
    }
    setTempoExibido(formatElapsedMs(elapsedLiveMs));
  }, [elapsedLiveMs, estado, pause]);

  const syncPausado = useCallback((ms: number) => {
    const fmt = formatElapsedMs(ms);
    setTempoExibido(fmt);
    setPausadoTexto(fmt);
    pausadoTextoRef.current = fmt;
    return fmt;
  }, []);

  const resetCronometro = useCallback(() => {
    pause();
    reset(undefined, false);
    tempoParadoMsRef.current = null;
    maxReachedRef.current = false;
    setEstado('inicial');
    syncPausado(0);
  }, [pause, reset, syncPausado]);

  const iniciar = useCallback(() => {
    if (estado !== 'inicial' && estado !== 'finalizado') return;
    maxReachedRef.current = false;
    tempoParadoMsRef.current = null;
    reset(undefined, false);
    syncPausado(0);
    setEstado('rodando');
    start();
  }, [estado, reset, start, syncPausado]);

  const pausar = useCallback(() => {
    if (estado !== 'rodando') return;
    pause();
    const ms = totalMilliseconds;
    syncPausado(ms);
    setEstado('pausado');
  }, [estado, pause, totalMilliseconds, syncPausado]);

  const aplicarTextoPausado = useCallback((): number | null => {
    const ms = parseFormatoElapsedParaMs(pausadoTextoRef.current.trim());
    return ms;
  }, []);

  const continuar = useCallback((): boolean => {
    if (estado !== 'pausado') return false;
    const ms = aplicarTextoPausado();
    if (ms == null) return false;
    maxReachedRef.current = false;
    reset(stopwatchOffsetFromElapsedMs(ms), true);
    syncPausado(ms);
    setEstado('rodando');
    return true;
  }, [estado, aplicarTextoPausado, reset, syncPausado]);

  const parar = useCallback((): boolean => {
    if (estado !== 'rodando' && estado !== 'pausado') return false;
    let totalMs = totalMilliseconds;
    if (estado === 'pausado') {
      const edited = aplicarTextoPausado();
      if (edited == null) return false;
      totalMs = edited;
    } else {
      pause();
      totalMs = totalMilliseconds;
    }
    tempoParadoMsRef.current = totalMs;
    syncPausado(totalMs);
    setEstado('finalizado');
    return true;
  }, [estado, totalMilliseconds, pause, aplicarTextoPausado, syncPausado]);

  /** Força encerramento no limite (permanência). */
  const finalizarNoMs = useCallback(
    (ms: number) => {
      pause();
      maxReachedRef.current = true;
      tempoParadoMsRef.current = ms;
      syncPausado(ms);
      setEstado('finalizado');
    },
    [pause, syncPausado],
  );

  const getElapsedMs = useCallback((): number | null => {
    if (estado === 'rodando') return totalMilliseconds;
    if (estado === 'pausado') {
      const parsed = parseFormatoElapsedParaMs(pausadoTextoRef.current.trim());
      if (parsed != null) return parsed;
      return totalMilliseconds;
    }
    if (estado === 'finalizado' && tempoParadoMsRef.current != null) {
      return tempoParadoMsRef.current;
    }
    return null;
  }, [estado, totalMilliseconds]);

  const onPausadoTextoChange = useCallback((text: string) => {
    setPausadoTexto(text);
    pausadoTextoRef.current = text;
  }, []);

  const onBlurPausado = useCallback(() => {
    const ms = parseFormatoElapsedParaMs(pausadoTextoRef.current.trim());
    if (ms == null) {
      syncPausado(totalMilliseconds);
      return;
    }
    reset(stopwatchOffsetFromElapsedMs(ms), false);
    syncPausado(ms);
  }, [totalMilliseconds, reset, syncPausado]);

  return {
    estado,
    isRunning,
    tempoExibido,
    pausadoTexto,
    pausadoTextoRef,
    tempoParadoMsRef,
    resetCronometro,
    iniciar,
    pausar,
    continuar,
    parar,
    finalizarNoMs,
    getElapsedMs,
    onPausadoTextoChange,
    onBlurPausado,
    aplicarTextoPausado,
    syncPausado,
  };
}
