/**
 * Formatação de tempo por modalidade TAF (UI e persistência de strings).
 * — Corrida: MM:SS (ex.: 66 s → "01:06")
 * — Natação: segundos inteiros + espaço + "S" (ex.: "60 S"); única letra permitida na exibição.
 */

import { formatElapsedMs, parseFormatoElapsedParaMs } from '../utils/formatRaceTime';

export type TafModality = 'corrida' | 'natacao';

/** Exibe milissegundos conforme a modalidade ativa. */
export function formatMsByModality(modality: TafModality, ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  if (modality === 'natacao') {
    return `${Math.floor(ms / 1000)} S`;
  }
  return formatElapsedMs(ms);
}

/**
 * Interpreta input de performance para milissegundos.
 * Corrida: MM:SS / HH:MM:SS (via `parseFormatoElapsedParaMs`).
 * Natação: só dígitos, ou com sufixo " S" / "S" / formatações antigas ("seg", "segundos").
 */
export function parseTafPerformanceInput(modality: TafModality, text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (modality === 'corrida') {
    return parseFormatoElapsedParaMs(t);
  }
  let n = t
    .replace(/\s*segundos?\s*$/i, '')
    .replace(/\s*seg\s*$/i, '')
    .replace(/\s+[Ss]\s*$/i, '')
    .replace(/[Ss]$/i, '')
    .trim();
  if (!/^\d+$/.test(n)) return null;
  const sec = parseInt(n, 10);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return sec * 1000;
}
