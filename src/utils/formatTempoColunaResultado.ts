import type { ResultadoCorridaItem } from '../navigation/types';
import { formatMsByModality } from '../taf/tafTimeFormat';

/** Remove prefixo legado "Desistência" da coluna Tempo (PDF / planilha / UI). */
export function stripPrefixoDesistenciaTempo(texto: string): string {
  return texto.replace(/^desist[eê]ncia\s*/i, '').trim();
}

/**
 * Valor da coluna Tempo: só o cronômetro (nunca a palavra "Desistência").
 * Compatível com sessões antigas que gravaram "Desistência MM:SS:CS".
 */
export function formatTempoColunaResultado(r: ResultadoCorridaItem): string {
  const raw = (r.desempenhoTexto ?? '').trim();
  const semDesist = stripPrefixoDesistenciaTempo(raw);
  if (semDesist) return semDesist;

  const prova = r.prova ?? 'corrida';
  const mod = prova === 'natacao' || prova === 'abdominal_prancha' ? 'natacao' : 'corrida';

  // Legado: só a palavra "Desistência" sem tempo.
  if (r.desistencia || /^desist/i.test(raw)) {
    if (Number.isFinite(r.tempoMs) && r.tempoMs > 0) {
      return formatMsByModality(mod, r.tempoMs);
    }
    return '—';
  }

  if (
    prova === 'flexao_barra' ||
    prova === 'flexao_solo' ||
    prova === 'abdominal_remador'
  ) {
    return Number.isFinite(r.tempoMs) && r.tempoMs > 0 ? `${r.tempoMs} rep.` : '—';
  }
  if (prova === 'corrida' || prova === 'natacao') {
    return formatMsByModality(prova, r.tempoMs);
  }
  if (Number.isFinite(r.tempoMs) && r.tempoMs > 0) {
    return formatMsByModality(mod, r.tempoMs);
  }
  return '—';
}
