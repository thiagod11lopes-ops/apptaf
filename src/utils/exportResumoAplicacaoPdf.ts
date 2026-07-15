import { Platform } from 'react-native';
import * as Print from 'expo-print';
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
  buildPdfTableHtml,
  escapeHtmlPdf,
  estimarFolhasPdfPorLinhas,
  PDF_A4_LANDSCAPE_HEIGHT,
  PDF_A4_LANDSCAPE_WIDTH,
  PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA,
} from './pdfLayout';
import {
  baixarArquivoParaDownloads,
  entregarPdfBlobWeb,
  mensagemSucessoSalvarNaPasta,
  sanitizarNomeArquivo,
  SalvamentoCanceladoError,
} from './salvarArquivoNaPasta';
import { formatBrDateKey, formatBrTimeKey } from './backupNaming';
import { gerarResumoAplicacaoPdfBlobWeb } from './gerarResumoAplicacaoPdfWeb';
/** Estima quantas folhas A4 paisagem serão necessárias para o resumo da aplicação. */
export function estimarFolhasA4PdfResumoAplicacao(
  quantidadeLinhas: number,
  comAssinaturaAplicador = true,
): number {
  return estimarFolhasPdfPorLinhas(
    quantidadeLinhas,
    comAssinaturaAplicador ? PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA : undefined,
  );
}

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

  const theadPdf = `<tr><th>${colProva}</th><th class="col-nome">Nome</th><th>NIP</th><th>Tempo</th><th>Nota</th><th>Situação</th><th class="col-rubrica">Rúbrica</th></tr>`;

  const rows = resultados.map((r) => {
      const papel = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
      const nip = r.nip ? escapeHtmlPdf(r.nip) : '—';
      const nota = escapeHtmlPdf(r.notaTexto ?? '—');
      const situacao = escapeHtmlPdf(
        r.reprovacaoTexto ?? (r.notaTexto === 'REPROVADO' ? 'Reprovado' : 'Aprovado'),
      );
      const rubrica = celulaRubricaHtml(r.rubricaCandidatoSvg);
      return `<tr>
        <td>${papel} ${r.corredor}</td>
        <td class="col-nome">${escapeHtmlPdf(r.nome)}</td>
        <td>${nip}</td>
        <td class="tempo">${escapeHtmlPdf(formatMsByModality(r.prova ?? 'corrida', r.tempoMs))}</td>
        <td class="nota">${nota}</td>
        <td class="repro">${situacao}</td>
        <td class="col-rubrica">${rubrica}</td>
      </tr>`;
    });

  const metaHtml = `Gerado em ${escapeHtmlPdf(dataStr)} · <strong>${tituloProva}</strong>`;
  const comAssinatura = Boolean(aplicadorAssinatura?.nome?.trim());

  const conteudoHtml =
    resultados.length === 0
      ? '<p style="color:#9CA3AF;font-weight:700;">Nenhum resultado nesta sessão.</p>'
      : buildPdfTableHtml({
          tableClass: 'resultados-taf',
          theadHtml: theadPdf,
          rowHtml: rows,
          emptyColspan: 7,
          rowsPerPage: comAssinatura ? PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA : undefined,
        });

  return buildPdfLandscapeDocument({
    documentTitle: titulo,
    titulo,
    metaHtml,
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
 * Nome do arquivo: NomeDoTeste_DataDoTeste_HoraDoSalvamento.pdf
 * Ex.: Corrida_14-07-2026_21h05m32.pdf
 */
export function nomeArquivoPdfResumo(
  resultados: ResultadoCorridaItem[],
  momentoSalvamento: Date = new Date(),
): string {
  const nomeTeste = sanitizarNomeArquivo(tituloProvaResumoPdf(resultados)).replace(/\s+/g, '_');
  const dataTeste = formatBrDateKey(momentoSalvamento);
  const horaSalvamento = formatBrTimeKey(momentoSalvamento);
  return sanitizarNomeArquivo(`${nomeTeste}_${dataTeste}_${horaSalvamento}`, '.pdf');
}

/**
 * Gera o PDF em silêncio e baixa para Downloads (web/Android) ou Arquivos (iOS).
 * Não abre o PDF na tela.
 */
export async function exportResumoAplicacaoPdf(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<string> {
  if (resultados.length === 0) {
    throw new Error('Não há resultados para salvar.');
  }

  const filename = nomeArquivoPdfResumo(resultados);

  if (Platform.OS === 'web') {
    // iPhone/Safari: html2canvas gera PDF em branco — usa jsPDF + Compartilhar.
    const blob = await gerarResumoAplicacaoPdfBlobWeb(resultados, aplicadorAssinatura);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) {
      throw new SalvamentoCanceladoError();
    }
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  // HTML ainda alimenta o print nativo (Android/iOS app).
  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro, undefined, aplicadorAssinatura);

  const { uri } = await Print.printToFileAsync({
    html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });

  const resultado = await baixarArquivoParaDownloads({
    sourceUri: uri,
    filename,
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
    dialogTitle: 'Salvar PDF em Downloads',
  });

  if (!resultado.ok) {
    throw new SalvamentoCanceladoError();
  }
  return mensagemSucessoSalvarNaPasta(resultado);
}
