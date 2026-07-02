import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoTafLinha } from './resultadoTafCadastro';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { celulaRubricaHtml, PDF_TABELA_COMPACTA_STYLES, RUBRICA_PDF_STYLES } from './rubricaHtml';
import {
  blocosAplicadorAssinaturaHtml,
  PDF_APLICADOR_ASSINATURA_STYLES,
} from './pdfAplicadorAssinaturaHtml';
import {
  buildPdfLandscapeDocument,
  buildPaginatedPdfTableHtml,
  escapeHtmlPdf,
  PDF_A4_LANDSCAPE_HEIGHT,
  PDF_A4_LANDSCAPE_WIDTH,
} from './pdfLayout';

/** Altura útil estimada por linha (rúbricas) em pontos — A4 paisagem. */
const PDF_RESULTADOS_ROW_HEIGHT_PT = 48;
/** Cada folha inclui título, meta, thead e assinatura do aplicador no fluxo. */
const PDF_RESULTADOS_PAGE_OVERHEAD_PT = 175;
const PDF_RESULTADOS_PAGE_USABLE_PT = PDF_A4_LANDSCAPE_HEIGHT - PDF_RESULTADOS_PAGE_OVERHEAD_PT;
const PDF_RESULTADOS_ROWS_PER_PAGE = Math.max(
  1,
  Math.floor(PDF_RESULTADOS_PAGE_USABLE_PT / PDF_RESULTADOS_ROW_HEIGHT_PT),
);
const PDF_RESULTADOS_ROWS_FIRST_PAGE = PDF_RESULTADOS_ROWS_PER_PAGE;
const PDF_RESULTADOS_ROWS_OTHER_PAGE = PDF_RESULTADOS_ROWS_PER_PAGE;

/** Estima quantas folhas A4 paisagem serão necessárias para imprimir a tabela de resultados. */
export function estimarFolhasA4PdfResultadosTaf(quantidadeLinhas: number): number {
  if (quantidadeLinhas <= 0) return 0;
  if (quantidadeLinhas <= PDF_RESULTADOS_ROWS_FIRST_PAGE) return 1;
  const restantes = quantidadeLinhas - PDF_RESULTADOS_ROWS_FIRST_PAGE;
  return 1 + Math.ceil(restantes / PDF_RESULTADOS_ROWS_OTHER_PAGE);
}

/** Tempo padrão da prova de permanência em relatórios PDF. */
export const PERMANENCIA_TEMPO_PDF_PADRAO = '10 minutos';

const TITULO_RESULTADOS_TAF = 'Resultados TAF — Corrida, Caminhada, Natação e Permanência';

const RESULTADOS_TAF_THEAD = `<tr>
        <th>Posto/Grad.</th>
        <th>NIP</th>
        <th>Nome</th>
        <th>Nota corrida</th>
        <th>Situação corrida</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Nota caminhada</th>
        <th>Situação caminhada</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Nota natação</th>
        <th>Situação natação</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Situação permanência</th>
        <th class="col-rubrica">Rúbrica</th>
      </tr>`;

export function buildResultadosTafHtml(
  linhas: ResultadoTafLinha[],
  subtitulo: string,
  aplicadorAssinaturas?: AplicadorAssinaturaResumo[],
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const rows = linhas.map(
      (r) => `<tr>
        <td>${escapeHtmlPdf(r.postoGrad)}</td>
        <td>${escapeHtmlPdf(r.nip)}</td>
        <td>${escapeHtmlPdf(r.nome)}</td>
        <td class="nota">${escapeHtmlPdf(r.notaCorrida)}</td>
        <td>${escapeHtmlPdf(r.situacaoCorrida)}</td>
        <td class="col-rubrica">${celulaRubricaHtml(r.rubricaCorridaSvg)}</td>
        <td class="nota">${escapeHtmlPdf(r.notaCaminhada)}</td>
        <td>${escapeHtmlPdf(r.situacaoCaminhada)}</td>
        <td class="col-rubrica">${celulaRubricaHtml(r.rubricaCaminhadaSvg)}</td>
        <td class="nota">${escapeHtmlPdf(r.notaNatacao)}</td>
        <td>${escapeHtmlPdf(r.situacaoNatacao)}</td>
        <td class="col-rubrica">${celulaRubricaHtml(r.rubricaNatacaoSvg)}</td>
        <td>${escapeHtmlPdf(r.situacaoPermanencia)}</td>
        <td class="col-rubrica">${celulaRubricaHtml(r.rubricaPermanenciaSvg)}</td>
      </tr>`,
    );

  const metaHtml = `${escapeHtmlPdf(subtitulo)} · Gerado em ${escapeHtmlPdf(dataStr)} · ${linhas.length} registro(s)`;

  const conteudoHtml = buildPaginatedPdfTableHtml({
    tableClass: 'resultados-taf',
    theadHtml: RESULTADOS_TAF_THEAD,
    rowHtml: rows,
    rowsFirstPage: PDF_RESULTADOS_ROWS_FIRST_PAGE,
    rowsOtherPage: PDF_RESULTADOS_ROWS_OTHER_PAGE,
    emptyColspan: 14,
    pageDocHeaderHtml: `<h1>${escapeHtmlPdf(TITULO_RESULTADOS_TAF)}</h1><p class="meta">${metaHtml}</p>`,
    pageDocFooterHtml: blocosAplicadorAssinaturaHtml(aplicadorAssinaturas),
  });

  return buildPdfLandscapeDocument({
    documentTitle: 'Resultados TAF',
    titulo: TITULO_RESULTADOS_TAF,
    metaHtml: `${escapeHtmlPdf(subtitulo)} · Gerado em ${escapeHtmlPdf(dataStr)} · ${linhas.length} registro(s)`,
    conteudoHtml,
    aplicadorHtml: blocosAplicadorAssinaturaHtml(aplicadorAssinaturas),
    extraStyles: `
      ${PDF_TABELA_COMPACTA_STYLES}
      ${RUBRICA_PDF_STYLES}
      ${PDF_APLICADOR_ASSINATURA_STYLES}
    `,
  });
}

export async function exportResultadosTafPdf(
  linhas: ResultadoTafLinha[],
  subtitulo: string,
  aplicadorAssinaturas?: AplicadorAssinaturaResumo[],
): Promise<void> {
  if (linhas.length === 0) {
    throw new Error('Não há resultados para exportar.');
  }

  const html = buildResultadosTafHtml(linhas, subtitulo, aplicadorAssinaturas);

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
      dialogTitle: 'Salvar PDF — Resultados TAF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('PDF gerado', 'Arquivo salvo na área de cache do app.');
  }
}
