/**
 * Formatação de tempo por modalidade TAF (UI e persistência de strings).
 * Corrida e natação: exibição e entrada em **MM:SS** (minutos:segundos).
 */

import { formatElapsedMs, parseFormatoElapsedParaMs } from '../utils/formatRaceTime';

export type TafModality = 'corrida' | 'natacao';

/** Exibe milissegundos em MM:SS (corrida e natação). */
export function formatMsByModality(modality: TafModality, ms: number): string {
  void modality;
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  return formatElapsedMs(ms);
}

/**
 * Interpreta texto de performance → milissegundos.
 * MM:SS / HH:MM:SS. Natação aceita também legado "90 S" / só dígitos (segundos).
 */
export function parseTafPerformanceInput(modality: TafModality, text: string): number | null {
  const t = text.trim();
  if (!t) return null;

  const mmssMs = parseFormatoElapsedParaMs(t);
  if (mmssMs != null) return mmssMs;

  if (modality === 'natacao') {
    let n = t
      .replace(/\s*segundos?\s*$/i, '')
      .replace(/\s*seg\s*$/i, '')
      .replace(/\s+[Ss]\s*$/i, '')
      .replace(/[Ss]$/i, '')
      .trim();
    if (/^\d+$/.test(n)) {
      const sec = parseInt(n, 10);
      if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
    }
  }

  return null;
}

/** Normaliza tempo salvo para exibição MM:SS (inclui conversão de "90 S" antigo). */
export function formatTempoNatacaoParaExibicao(tempo: string | undefined): string {
  const t = (tempo ?? '').trim();
  if (!t) return '';
  const ms = parseTafPerformanceInput('natacao', t);
  if (ms != null) return formatMsByModality('natacao', ms);
  return t;
}
