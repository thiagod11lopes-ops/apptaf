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
  buildPdfTableHtml,
  escapeHtmlPdf,
  estimarFolhasPdfPorLinhas,
  PDF_A4_LANDSCAPE_HEIGHT,
  PDF_A4_LANDSCAPE_WIDTH,
  PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA,
} from './pdfLayout';

/** Estima quantas folhas A4 paisagem serão necessárias para imprimir a tabela de resultados. */
export function estimarFolhasA4PdfResultadosTaf(
  quantidadeLinhas: number,
  comAssinaturaAplicador = false,
): number {
  return estimarFolhasPdfPorLinhas(
    quantidadeLinhas,
    comAssinaturaAplicador ? PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA : undefined,
  );
}

/** Tempo padrão da prova de permanência em relatórios PDF. */
export const PERMANENCIA_TEMPO_PDF_PADRAO = '10 minutos';

const TITULO_RESULTADOS_TAF = 'Resultados TAF — Corrida, Caminhada, Natação e Permanência';

const RESULTADOS_TAF_THEAD = `<tr>
        <th>P/G</th>
        <th>NIP</th>
        <th class="col-nome">Nome</th>
        <th>Nota corrida</th>
        <th>Situação</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Nota caminhada</th>
        <th>Situação</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Nota natação</th>
        <th>Situação</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Situação Permanência</th>
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
        <td class="col-nome">${escapeHtmlPdf(r.nome)}</td>
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
  const comAssinatura = Boolean(aplicadorAssinaturas?.some((a) => a.nome?.trim()));

  const conteudoHtml = buildPdfTableHtml({
    tableClass: 'resultados-taf',
    theadHtml: RESULTADOS_TAF_THEAD,
    rowHtml: rows,
    emptyColspan: 14,
    rowsPerPage: comAssinatura ? PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA : undefined,
  });

  return buildPdfLandscapeDocument({
    documentTitle: 'Resultados TAF',
    titulo: TITULO_RESULTADOS_TAF,
    metaHtml,
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
