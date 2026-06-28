import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { tituloTipoProva, type TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { celulaRubricaHtml, PDF_TABELA_COMPACTA_STYLES, RUBRICA_PDF_STYLES } from './rubricaHtml';
import {
  blocoAplicadorAssinaturaHtml,
  PDF_APLICADOR_ASSINATURA_STYLES,
} from './pdfAplicadorAssinaturaHtml';
import {
  buildPdfLandscapeDocument,
  escapeHtmlPdf,
  PDF_A4_LANDSCAPE_HEIGHT,
  PDF_A4_LANDSCAPE_WIDTH,
} from './pdfLayout';

/** Inferência do rótulo da prova (Corrida, Natação, etc.) a partir dos resultados da sessão. */
export function tituloProvaResumoPdf(resultados: ResultadoCorridaItem[]): string {
  const prova = resultados.find((r) => r.prova)?.prova ?? 'corrida';
  return tituloTipoProva(prova as TipoProvaAplicada);
}

/** Cabeçalho da 1ª coluna: Nadador (só natação), Corredor (só corrida), ou ambos se misto. */
export function cabecalhoColunaProvaResultados(resultados: ResultadoCorridaItem[]): string {
  const temNatacao = resultados.some((r) => r.prova === 'natacao');
  const temCorrida = resultados.some((r) => r.prova !== 'natacao');
  if (temNatacao && !temCorrida) return 'Nadador';
  if (temCorrida && !temNatacao) return 'Corredor';
  return 'Corredor / Nadador';
}

/**
 * HTML completo do resumo (impressão / PDF nativo).
 */
export function buildResumoAplicacaoHtml(
  resultados: ResultadoCorridaItem[],
  _textoColunaCadastro: string,
  titulo = 'Resumo da aplicação — TAF',
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const colProva = escapeHtmlPdf(cabecalhoColunaProvaResultados(resultados));
  const tituloProva = escapeHtmlPdf(tituloProvaResumoPdf(resultados));

  const theadPdf = `<th>${colProva}</th><th>Nome</th><th>NIP</th><th>Tempo</th><th>Nota</th><th>Situação</th><th class="col-rubrica">Rúbrica</th>`;

  const rows = resultados
    .map((r) => {
      const papel = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
      const nip = r.nip ? escapeHtmlPdf(r.nip) : '—';
      const nota = escapeHtmlPdf(r.notaTexto ?? '—');
      const situacao = escapeHtmlPdf(
        r.reprovacaoTexto ?? (r.notaTexto === 'REPROVADO' ? 'Reprovado' : 'Aprovado'),
      );
      const rubrica = celulaRubricaHtml(r.rubricaCandidatoSvg);
      return `<tr>
        <td>${papel} ${r.corredor}</td>
        <td>${escapeHtmlPdf(r.nome)}</td>
        <td>${nip}</td>
        <td class="tempo">${escapeHtmlPdf(formatMsByModality(r.prova ?? 'corrida', r.tempoMs))}</td>
        <td class="nota">${nota}</td>
        <td class="repro">${situacao}</td>
        <td class="col-rubrica">${rubrica}</td>
      </tr>`;
    })
    .join('');

  const conteudoHtml =
    resultados.length === 0
      ? '<p style="color:#9CA3AF;font-weight:700;">Nenhum resultado nesta sessão.</p>'
      : `<table class="resultados-taf">
    <thead><tr>${theadPdf}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  return buildPdfLandscapeDocument({
    documentTitle: titulo,
    titulo,
    metaHtml: `Gerado em ${escapeHtmlPdf(dataStr)} · <strong>${tituloProva}</strong>`,
    conteudoHtml,
    aplicadorHtml: blocoAplicadorAssinaturaHtml(aplicadorAssinatura),
    extraStyles: `
      .tempo { font-weight: 800; color: #15803D; font-family: ui-monospace, monospace; }
      ${PDF_TABELA_COMPACTA_STYLES}
      ${RUBRICA_PDF_STYLES}
      ${PDF_APLICADOR_ASSINATURA_STYLES}
    `,
  });
}

/**
 * Gera PDF no dispositivo (nativo) ou abre visualização HTML (web — imprimir/salvar manualmente).
 */
export async function exportResumoAplicacaoPdf(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<void> {
  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro, undefined, aplicadorAssinatura);

  if (Platform.OS === 'web') {
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!win) {
      throw new Error(
        'Não foi possível abrir a visualização do PDF. Permita pop-ups neste site e tente novamente.',
      );
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Salvar PDF — Resumo TAF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert(
      'PDF gerado',
      'Não foi possível abrir o compartilhamento neste dispositivo. O arquivo foi salvo na área de cache do app.',
    );
  }
}
