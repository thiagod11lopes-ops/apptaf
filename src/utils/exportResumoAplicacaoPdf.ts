import { Platform } from 'react-native';
import * as Print from 'expo-print';
import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import {
  tituloTipoProva,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import { isNotaReprovacaoTexto } from './notaReprovacaoTexto';
import { formatTempoColunaResultado } from './formatTempoColunaResultado';
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
import {
  gerarResumoAplicacaoPdfBlobWeb,
  gerarResumosAplicacaoPdfBlobWeb,
  type ResumoAplicacaoPdfBloco,
} from './gerarResumoAplicacaoPdfWeb';
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
        r.reprovacaoTexto ??
          (r.desistencia || isNotaReprovacaoTexto(r.notaTexto) ? 'Reprovado' : 'Aprovado'),
      );
      const rubrica = celulaRubricaHtml(r.rubricaCandidatoSvg);
      return `<tr>
        <td>${papel} ${r.corredor}</td>
        <td class="col-nome">${escapeHtmlPdf(r.nome)}</td>
        <td>${nip}</td>
        <td class="tempo">${escapeHtmlPdf(formatTempoColunaResultado(r))}</td>
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
 * Gera o PDF em silêncio e baixa para Downloads (web/iPhone/Android).
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
    // iPhone/Safari: html2canvas gera PDF em branco — usa jsPDF + download direto.
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

/** Resultado com `prova` preenchida a partir do tipo da sessão (layout igual ao Salvar). */
export function resultadosSessaoParaResumoPdf(
  sessao: SessaoAplicacaoTaf,
): ResultadoCorridaItem[] {
  return sessao.resultados.map((r) => ({
    ...r,
    prova: r.prova ?? sessao.tipoProva,
  }));
}

/** Blocos de resumo (um por sessão) em ordem cronológica — mesmo layout do Salvar. */
export function montarBlocosResumoPdfDasSessoes(
  sessoes: SessaoAplicacaoTaf[],
): ResumoAplicacaoPdfBloco[] {
  const ordenadas = [...sessoes].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const blocos: ResumoAplicacaoPdfBloco[] = [];
  for (const sessao of ordenadas) {
    const resultados = resultadosSessaoParaResumoPdf(sessao);
    if (resultados.length === 0) continue;
    blocos.push({
      resultados,
      aplicadorAssinatura: sessao.aplicadorAssinatura,
    });
  }
  return blocos;
}

/**
 * Nome: Resultados_do_dia_DD-MM-AAAA.pdf
 * (data do dia selecionado no histórico, não a do salvamento).
 */
export function nomeArquivoPdfResultadosDoDia(dataBr: string): string {
  const dataKey = dataBr.trim().replace(/\//g, '-');
  return sanitizarNomeArquivo(`Resultados_do_dia_${dataKey || formatBrDateKey()}`, '.pdf');
}

/**
 * HTML nativo: um bloco (mesmo do Salvar) ou vários seções com quebra de página.
 */
export function buildResumosAplicacaoDiaHtml(
  blocos: ResumoAplicacaoPdfBloco[],
  tituloDocumento = 'Resultados do dia — TAF',
): string {
  if (blocos.length === 0) {
    throw new Error('Não há resultados para salvar.');
  }
  if (blocos.length === 1) {
    const unico = blocos[0]!;
    return buildResumoAplicacaoHtml(
      unico.resultados,
      '',
      undefined,
      unico.aplicadorAssinatura,
    );
  }

  const dataStr = new Date().toLocaleString('pt-BR');
  const secoes = blocos.map((bloco, i) => {
    const resultados = bloco.resultados;
    const colProva = escapeHtmlPdf(cabecalhoColunaProvaResultados(resultados));
    const tituloProva = escapeHtmlPdf(tituloProvaResumoPdf(resultados));
    const theadPdf = `<tr><th>${colProva}</th><th class="col-nome">Nome</th><th>NIP</th><th>Tempo</th><th>Nota</th><th>Situação</th><th class="col-rubrica">Rúbrica</th></tr>`;
    const rows = resultados.map((r) => {
      const papel = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
      const nip = r.nip ? escapeHtmlPdf(r.nip) : '—';
      const nota = escapeHtmlPdf(r.notaTexto ?? '—');
      const situacao = escapeHtmlPdf(
        r.reprovacaoTexto ??
          (r.desistencia || isNotaReprovacaoTexto(r.notaTexto) ? 'Reprovado' : 'Aprovado'),
      );
      const rubrica = celulaRubricaHtml(r.rubricaCandidatoSvg);
      return `<tr>
        <td>${papel} ${r.corredor}</td>
        <td class="col-nome">${escapeHtmlPdf(r.nome)}</td>
        <td>${nip}</td>
        <td class="tempo">${escapeHtmlPdf(formatTempoColunaResultado(r))}</td>
        <td class="nota">${nota}</td>
        <td class="repro">${situacao}</td>
        <td class="col-rubrica">${rubrica}</td>
      </tr>`;
    });
    const tabela = buildPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: theadPdf,
      rowHtml: rows,
      emptyColspan: 7,
      rowsPerPage: bloco.aplicadorAssinatura
        ? PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA
        : undefined,
    });
    const breakCls = i < blocos.length - 1 ? ' style="page-break-after: always;"' : '';
    return `<section class="resumo-sessao"${breakCls}>
      <h2 class="resumo-sessao-titulo">Resumo da aplicação — TAF</h2>
      <p class="resumo-sessao-meta">Gerado em ${escapeHtmlPdf(dataStr)} · <strong>${tituloProva}</strong></p>
      ${tabela}
      <div class="resumo-sessao-assinatura">${blocoAplicadorAssinaturaHtml(bloco.aplicadorAssinatura)}</div>
    </section>`;
  });

  return buildPdfLandscapeDocument({
    documentTitle: tituloDocumento,
    titulo: tituloDocumento,
    metaHtml: `Gerado em ${escapeHtmlPdf(dataStr)} · ${blocos.length} aplicações`,
    conteudoHtml: secoes.join('\n'),
    extraStyles: `
      .tempo { font-weight: 800; color: #15803D; font-family: ui-monospace, monospace; }
      .resumo-sessao-titulo { font-size: 16px; margin: 0 0 4px; }
      .resumo-sessao-meta { color: #6B7280; font-size: 11px; margin: 0 0 10px; }
      .resumo-sessao-assinatura { margin-top: 18px; }
      ${PDF_TABELA_COMPACTA_STYLES}
      ${RUBRICA_PDF_STYLES}
      ${PDF_APLICADOR_ASSINATURA_STYLES}
    `,
  });
}

/**
 * Um PDF do dia no formato do Salvar pós-rúbrica (uma seção por sessão).
 */
export async function exportResumosSessoesDiaPdf(
  sessoes: SessaoAplicacaoTaf[],
  dataBr: string,
): Promise<string> {
  const blocos = montarBlocosResumoPdfDasSessoes(sessoes);
  if (blocos.length === 0) {
    throw new Error('Não há participantes para exportar neste dia.');
  }

  const filename = nomeArquivoPdfResultadosDoDia(dataBr);

  if (Platform.OS === 'web') {
    const blob = await gerarResumosAplicacaoPdfBlobWeb(blocos);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) {
      throw new SalvamentoCanceladoError();
    }
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildResumosAplicacaoDiaHtml(
    blocos,
    `Resultados do dia — ${dataBr.trim() || 'TAF'}`,
  );
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
