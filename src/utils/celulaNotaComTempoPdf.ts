import { escapeHtmlPdf } from './pdfLayout';

/** Tempo exibível no PDF (vazio se ausente ou "—"). */
export function tempoParaCelulaPdf(tempo?: string | null): string {
  const t = (tempo ?? '').trim();
  if (!t || t === '—') return '';
  return t;
}

/**
 * Célula HTML de nota com tempo da prova abaixo, quando houver.
 * Ex.: `80` + `12:34` ou só `REPROVADO`.
 */
export function celulaNotaComTempoHtml(nota: string, tempo?: string | null): string {
  const n = escapeHtmlPdf((nota || '').trim() || '—');
  const t = tempoParaCelulaPdf(tempo);
  if (!t) return `<td class="nota">${n}</td>`;
  return `<td class="nota">${n}<br/><span class="tempo">${escapeHtmlPdf(t)}</span></td>`;
}

/** Texto de situação da permanência com tempo abaixo (quando couber). */
export function celulaSituacaoComTempoHtml(
  situacao: string,
  tempo?: string | null,
): string {
  const s = escapeHtmlPdf((situacao || '').trim() || '—');
  const t = tempoParaCelulaPdf(tempo);
  if (!t) return `<td>${s}</td>`;
  return `<td>${s}<br/><span class="tempo">${escapeHtmlPdf(t)}</span></td>`;
}
