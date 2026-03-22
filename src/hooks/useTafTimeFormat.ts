import { useCallback, useMemo } from 'react';
import type { TafModality } from '../taf/tafTimeFormat';
import { formatMsByModality, parseTafPerformanceInput } from '../taf/tafTimeFormat';

export type UseTafTimeFormatResult = {
  modality: TafModality;
  /** Formata ms para exibição (MM:SS ou Ns). */
  formatMs: (ms: number) => string;
  /** Converte texto editado pelo utilizador → ms (ou null). */
  parseInput: (text: string) => number | null;
};

/**
 * Hook para cronómetro e labels alinhados à modalidade (corrida vs natação).
 * Sem modalidade definida, assume corrida (MM:SS).
 */
export function useTafTimeFormat(modality: TafModality | null | undefined): UseTafTimeFormatResult {
  const m: TafModality = modality ?? 'corrida';
  const formatMs = useCallback((ms: number) => formatMsByModality(m, ms), [m]);
  const parseInput = useCallback((text: string) => parseTafPerformanceInput(m, text), [m]);
  return useMemo(
    () => ({
      modality: m,
      formatMs,
      parseInput,
    }),
    [m, formatMs, parseInput],
  );
}
