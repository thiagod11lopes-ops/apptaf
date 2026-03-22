/**
 * Formatação de tempo por modalidade TAF (UI e persistência de strings).
 * — Corrida: MM:SS (ex.: 66 s → "01:06")
 * — Natação: segundos brutos com sufixo (ex.: "66s")
 */

import { formatElapsedMs, parseFormatoElapsedParaMs } from '../utils/formatRaceTime';

export type TafModality = 'corrida' | 'natacao';

/** Exibe milissegundos conforme a modalidade ativa. */
export function formatMsByModality(modality: TafModality, ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  if (modality === 'natacao') {
    return `${Math.floor(ms / 1000)}s`;
  }
  return formatElapsedMs(ms);
}

/**
 * Interpreta input de performance para milissegundos.
 * Corrida: MM:SS / HH:MM:SS (via `parseFormatoElapsedParaMs`).
 * Natação: só dígitos opcionalmente terminados em "s" (ex.: "66", "66s").
 */
export function parseTafPerformanceInput(modality: TafModality, text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (modality === 'corrida') {
    return parseFormatoElapsedParaMs(t);
  }
  const semSufixo = t.replace(/\s*s\s*$/i, '').trim();
  if (!/^\d+$/.test(semSufixo)) return null;
  const sec = parseInt(semSufixo, 10);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return sec * 1000;
}
