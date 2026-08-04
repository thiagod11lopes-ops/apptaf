import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoTafLinha } from './resultadoTafCadastro';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
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
import { gerarResultadosTafPdfBlobWeb } from './gerarResultadosTafPdfWeb';
import {
  colunasDistanciaPdfVisiveis,
  valoresCorridaCaminhadaParaPdf,
} from './corridaCaminhadaExcludente';
import {
  baixarArquivoParaDownloads,
  entregarPdfBlobWeb,
  mensagemSucessoSalvarNaPasta,
  SalvamentoCanceladoError,
  sanitizarNomeArquivo,
} from './salvarArquivoNaPasta';
import type { ResultadosTafPdfBloco } from './resultadosTafPdfPorAplicador';

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

/** Estima folhas somando blocos por aplicador (cada bloco começa em folha nova). */
export function estimarFolhasA4PdfResultadosTafBlocos(blocos: ResultadosTafPdfBloco[]): number {
  if (blocos.length === 0) return 0;
  return blocos.reduce(
    (acc, b) => acc + Math.max(1, estimarFolhasA4PdfResultadosTaf(b.linhas.length, true)),
    0,
  );
}

/** Tempo padrão da prova de permanência em relatórios PDF. */
export const PERMANENCIA_TEMPO_PDF_PADRAO = '10 minutos';

function tituloResultadosTafPdf(mostrarCorrida: boolean, mostrarCaminhada: boolean): string {
  const distancias: string[] = [];
  if (mostrarCorrida) distancias.push('Corrida');
  if (mostrarCaminhada) distancias.push('Caminhada');
  const prefixo = distancias.length > 0 ? distancias.join(', ') : 'Distância';
  return `Resultados TAF — ${prefixo}, Natação e Permanência`;
}

function buildResultadosTafTheadHtml(mostrarCorrida: boolean, mostrarCaminhada: boolean): string {
  const partes = [
    '<th>P/G</th>',
    '<th>NIP</th>',
    '<th class="col-nome">Nome</th>',
  ];
  if (mostrarCorrida) {
    partes.push('<th>Nota corrida</th>', '<th>Situação</th>', '<th class="col-rubrica">Rúbrica</th>');
  }
  if (mostrarCaminhada) {
    partes.push(
      '<th>Nota caminhada</th>',
      '<th>Situação</th>',
      '<th class="col-rubrica">Rúbrica</th>',
    );
  }
  partes.push(
    '<th>Nota natação</th>',
    '<th>Situação</th>',
    '<th class="col-rubrica">Rúbrica</th>',
    '<th>Situação Permanência</th>',
    '<th class="col-rubrica">Rúbrica</th>',
  );
  return `<tr>${partes.join('')}</tr>`;
}

function contarColunasResultadosTaf(mostrarCorrida: boolean, mostrarCaminhada: boolean): number {
  let n = 3 + 3 + 2; // P/G NIP Nome + natação (3) + permanência (2)
  if (mostrarCorrida) n += 3;
  if (mostrarCaminhada) n += 3;
  return n;
}

function buildLinhasTabelaHtml(
  linhas: ResultadoTafLinha[],
  mostrarCorrida: boolean,
  mostrarCaminhada: boolean,
): string[] {
  return linhas.map((r) => {
    const dist = valoresCorridaCaminhadaParaPdf(r);
    const celulas = [
      `<td>${escapeHtmlPdf(r.postoGrad)}</td>`,
      `<td>${escapeHtmlPdf(r.nip)}</td>`,
      `<td class="col-nome">${escapeHtmlPdf(r.nome)}</td>`,
    ];
    if (mostrarCorrida) {
      celulas.push(
        `<td class="nota">${escapeHtmlPdf(dist.notaCorrida)}</td>`,
        `<td>${escapeHtmlPdf(dist.situacaoCorrida)}</td>`,
        `<td class="col-rubrica">${celulaRubricaHtml(dist.rubricaCorridaSvg)}</td>`,
      );
    }
    if (mostrarCaminhada) {
      celulas.push(
        `<td class="nota">${escapeHtmlPdf(dist.notaCaminhada)}</td>`,
        `<td>${escapeHtmlPdf(dist.situacaoCaminhada)}</td>`,
        `<td class="col-rubrica">${celulaRubricaHtml(dist.rubricaCaminhadaSvg)}</td>`,
      );
    }
    celulas.push(
      `<td class="nota">${escapeHtmlPdf(r.notaNatacao)}</td>`,
      `<td>${escapeHtmlPdf(r.situacaoNatacao)}</td>`,
      `<td class="col-rubrica">${celulaRubricaHtml(r.rubricaNatacaoSvg)}</td>`,
      `<td>${escapeHtmlPdf(r.situacaoPermanencia)}</td>`,
      `<td class="col-rubrica">${celulaRubricaHtml(r.rubricaPermanenciaSvg)}</td>`,
    );
    return `<tr>${celulas.join('')}</tr>`;
  });
}

export function buildResultadosTafHtml(
  blocos: ResultadosTafPdfBloco[],
  subtitulo: string,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const todasLinhas = blocos.flatMap((b) => b.linhas);
  const { mostrarCorrida, mostrarCaminhada } = colunasDistanciaPdfVisiveis(todasLinhas);
  const titulo = tituloResultadosTafPdf(mostrarCorrida, mostrarCaminhada);
  const theadHtml = buildResultadosTafTheadHtml(mostrarCorrida, mostrarCaminhada);
  const colspan = contarColunasResultadosTaf(mostrarCorrida, mostrarCaminhada);
  const totalRegistros = todasLinhas.length;

  const secoes = blocos.map((bloco, index) => {
    const rows = buildLinhasTabelaHtml(bloco.linhas, mostrarCorrida, mostrarCaminhada);
    const tabelaHtml = buildPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml,
      rowHtml: rows,
      emptyColspan: colspan,
      rowsPerPage: PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA,
    });
    const assinaturaHtml = blocoAplicadorAssinaturaHtml(bloco.aplicadorAssinatura);
    const pageBreak = index > 0 ? ' pdf-aplicador-bloco--break' : '';
    return `<section class="pdf-aplicador-bloco${pageBreak}">
      <h2 class="pdf-aplicador-rotulo">${escapeHtmlPdf(bloco.rotuloAplicador)}</h2>
      ${tabelaHtml}
      <div class="pdf-aplicador-assinatura-slot">${assinaturaHtml || '<div class="aplicador-assinatura"><div class="aplicador-rubrica aplicador-rubrica-vazia"></div><hr class="aplicador-linha"/><p class="aplicador-identificacao"><span class="aplicador-nome">Aplicador</span></p></div>'}</div>
    </section>`;
  });

  const metaHtml = `${escapeHtmlPdf(subtitulo)} · Gerado em ${escapeHtmlPdf(dataStr)} · ${totalRegistros} registro(s) · ${blocos.length} aplicador(es)`;

  return buildPdfLandscapeDocument({
    documentTitle: 'Resultados TAF',
    titulo,
    metaHtml,
    conteudoHtml: secoes.join('\n'),
    // Assinatura fica por bloco — não usa rodapé global fixo.
    aplicadorHtml: undefined,
    extraStyles: `
      ${PDF_TABELA_COMPACTA_STYLES}
      ${RUBRICA_PDF_STYLES}
      ${PDF_APLICADOR_ASSINATURA_STYLES}
      .pdf-aplicador-bloco {
        page-break-inside: avoid;
      }
      .pdf-aplicador-bloco--break {
        page-break-before: always;
        break-before: page;
      }
      .pdf-aplicador-rotulo {
        font-size: 13px;
        font-weight: 800;
        color: #1e293b;
        margin: 0 0 8px;
      }
      .pdf-aplicador-assinatura-slot {
        margin-top: 14px;
        display: flex;
        justify-content: center;
      }
    `,
  });
}

/** Compat: uma tabela + lista de assinaturas → um bloco (ou N se já vierem blocos). */
export function normalizarBlocosResultadosTafPdf(
  linhasOuBlocos: ResultadoTafLinha[] | ResultadosTafPdfBloco[],
  aplicadorAssinaturas?: AplicadorAssinaturaResumo[],
): ResultadosTafPdfBloco[] {
  if (
    Array.isArray(linhasOuBlocos) &&
    linhasOuBlocos.length > 0 &&
    'rotuloAplicador' in (linhasOuBlocos[0] as object)
  ) {
    return linhasOuBlocos as ResultadosTafPdfBloco[];
  }
  const linhas = linhasOuBlocos as ResultadoTafLinha[];
  if (linhas.length === 0) return [];
  const assinatura = aplicadorAssinaturas?.find((a) => a.nome?.trim());
  return [
    {
      linhas,
      aplicadorAssinatura: assinatura,
      rotuloAplicador: assinatura?.nome?.trim()
        ? `Aplicador: ${assinatura.nome.trim()}`
        : 'Sem aplicador',
    },
  ];
}

function nomeArquivoPdfResultados(subtitulo: string): string {
  const base = sanitizarNomeArquivo(subtitulo || 'Resultados TAF')
    .replace(/[.—]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return sanitizarNomeArquivo(base || 'Resultados_TAF', '.pdf');
}

export async function exportResultadosTafPdf(
  linhasOuBlocos: ResultadoTafLinha[] | ResultadosTafPdfBloco[],
  subtitulo: string,
  aplicadorAssinaturas?: AplicadorAssinaturaResumo[],
): Promise<void> {
  const blocos = normalizarBlocosResultadosTafPdf(linhasOuBlocos, aplicadorAssinaturas);
  if (blocos.length === 0) {
    throw new Error('Não há resultados para exportar.');
  }

  const html = buildResultadosTafHtml(blocos, subtitulo);

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

/**
 * Gera um único PDF com resultados separados por aplicador e salva em Downloads.
 */
export async function salvarResultadosTafPdfEmDownloads(
  linhasOuBlocos: ResultadoTafLinha[] | ResultadosTafPdfBloco[],
  subtitulo: string,
  aplicadorAssinaturas?: AplicadorAssinaturaResumo[],
): Promise<string> {
  const blocos = normalizarBlocosResultadosTafPdf(linhasOuBlocos, aplicadorAssinaturas);
  if (blocos.length === 0) {
    throw new Error('Não há resultados para exportar.');
  }

  const filename = nomeArquivoPdfResultados(subtitulo);

  if (Platform.OS === 'web') {
    const blob = await gerarResultadosTafPdfBlobWeb(blocos, subtitulo);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) {
      throw new SalvamentoCanceladoError();
    }
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildResultadosTafHtml(blocos, subtitulo);
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
    dialogTitle: 'Salvar resultados do dia em Downloads',
  });

  if (!resultado.ok) {
    throw new SalvamentoCanceladoError();
  }
  return mensagemSucessoSalvarNaPasta(resultado);
}
