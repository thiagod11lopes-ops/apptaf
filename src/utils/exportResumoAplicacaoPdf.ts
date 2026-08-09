import { Platform } from 'react-native';
import * as Print from 'expo-print';

const PRINT_TIMEOUT_MS = 60_000;

/**
 * Envolve printToFileAsync com um timeout de 60 s.
 * O expo-print pode travar indefinidamente em HTML complexo (muitas rÃºbricas).
 */
async function printToFileComTimeout(
  options: Parameters<typeof Print.printToFileAsync>[0],
): Promise<{ uri: string }> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          'A geraÃ§Ã£o do PDF demorou muito. Tente com menos participantes ou sem rÃºbricas.',
        ),
      );
    }, PRINT_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([Print.printToFileAsync(options), timeout]);
    return result;
  } finally {
    clearTimeout(timeoutId!);
  }
}
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
import { agruparSessoesHistoricoPorTeste } from './agruparSessoesHistoricoPorTeste';
import {
  gerarResumoAplicacaoPdfBlobWeb,
  gerarResumosAplicacaoPdfBlobWeb,
  type ResumoAplicacaoPdfBloco,
} from './gerarResumoAplicacaoPdfWeb';

function base64ToUint8Array(base64: string): Uint8Array {
  const normalized = base64.replace(/[\r\n\s]/g, '');
  const atobFn =
    typeof globalThis.atob === 'function'
      ? globalThis.atob.bind(globalThis)
      : null;
  if (!atobFn) {
    throw new Error('DecodificaÃ§Ã£o Base64 indisponÃ­vel neste ambiente.');
  }
  const binary = atobFn(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * SessÃµes do HistÃ³rico consolidadas (1 bloco por aplicaÃ§Ã£o),
 * incluindo aplicaÃ§Ãµes sem assinatura do aplicador.
 */
export function sessoesHistoricoParaPdfBackup(
  sessoes: SessaoAplicacaoTaf[],
): SessaoAplicacaoTaf[] {
  return agruparSessoesHistoricoPorTeste(sessoes);
}

/** Nome: Resultados_historico_TAF_DD-MM-AAAA_HHhMMmSS.pdf */
export function nomeArquivoPdfResultadosHistorico(
  momento: Date = new Date(),
): string {
  return sanitizarNomeArquivo(
    `Resultados_historico_TAF_${formatBrDateKey(momento)}_${formatBrTimeKey(momento)}`,
    '.pdf',
  );
}

/**
 * Bytes do PDF no formato â€œGerar Resultados do diaâ€, com todo o histÃ³rico.
 * Retorna `null` se nÃ£o houver resultados (assinatura nÃ£o Ã© exigida).
 */
export async function buildResumosHistoricoPdfBytes(
  sessoes: SessaoAplicacaoTaf[],
): Promise<Uint8Array | null> {
  const agrupadas = sessoesHistoricoParaPdfBackup(sessoes);
  const ordenadas = [...agrupadas].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const blocos = montarBlocosResumoPdfDasSessoes(ordenadas);
  if (blocos.length === 0) return null;

  if (Platform.OS === 'web') {
    const blob = await gerarResumosAplicacaoPdfBlobWeb(blocos);
    return new Uint8Array(await blob.arrayBuffer());
  }

  const html = buildResumosAplicacaoDiaHtml(blocos, 'Resultados do histÃ³rico â€” TAF');
  const { uri } = await printToFileComTimeout({
    html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToUint8Array(base64);
}

/**
 * PDF do histÃ³rico completo (mesmo layout do dia), com assinaturas quando existirem.
 */
export async function exportResumosHistoricoCompletoPdf(
  sessoes: SessaoAplicacaoTaf[],
): Promise<string> {
  const agrupadas = sessoesHistoricoParaPdfBackup(sessoes);
  const ordenadas = [...agrupadas].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const blocos = montarBlocosResumoPdfDasSessoes(ordenadas);
  if (blocos.length === 0) {
    throw new Error('NÃ£o hÃ¡ resultados no histÃ³rico para exportar.');
  }

  const filename = nomeArquivoPdfResultadosHistorico();

  if (Platform.OS === 'web') {
    const blob = await gerarResumosAplicacaoPdfBlobWeb(blocos);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) {
      throw new SalvamentoCanceladoError();
    }
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildResumosAplicacaoDiaHtml(blocos, 'Resultados do histÃ³rico â€” TAF');
  const { uri } = await printToFileComTimeout({
    html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });

  const resultado = await baixarArquivoParaDownloads({
    sourceUri: uri,
    filename,
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
    dialogTitle: 'Salvar PDF do histÃ³rico em Downloads',
  });

  if (!resultado.ok) {
    throw new SalvamentoCanceladoError();
  }
  return mensagemSucessoSalvarNaPasta(resultado);
}
/** Estima quantas folhas A4 paisagem serÃ£o necessÃ¡rias para o resumo da aplicaÃ§Ã£o. */
export function estimarFolhasA4PdfResumoAplicacao(
  quantidadeLinhas: number,
  comAssinaturaAplicador = true,
): number {
  return estimarFolhasPdfPorLinhas(
    quantidadeLinhas,
    comAssinaturaAplicador ? PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA : undefined,
  );
}

/** InferÃªncia do rÃ³tulo da prova (Corrida, NataÃ§Ã£o, etc.) a partir dos resultados da sessÃ£o. */
export function tituloProvaResumoPdf(resultados: ResultadoCorridaItem[]): string {
  const prova = resultados.find((r) => r.prova)?.prova ?? 'corrida';
  return tituloTipoProva(prova as TipoProvaAplicada);
}

/** CabeÃ§alho da 1Âª coluna: Nadador (sÃ³ nataÃ§Ã£o), Corredor (sÃ³ corrida), ou ambos se misto. */
export function cabecalhoColunaProvaResultados(resultados: ResultadoCorridaItem[]): string {
  const temNatacao = resultados.some((r) => r.prova === 'natacao');
  const temCorrida = resultados.some((r) => r.prova !== 'natacao');
  if (temNatacao && !temCorrida) return 'Nadador';
  if (temCorrida && !temNatacao) return 'Corredor';
  return 'Corredor / Nadador';
}

/**
 * HTML completo do resumo (impressÃ£o / PDF nativo).
 */
export function buildResumoAplicacaoHtml(
  resultados: ResultadoCorridaItem[],
  _textoColunaCadastro: string,
  titulo = 'Resumo da aplicaÃ§Ã£o â€” TAF',
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const colProva = escapeHtmlPdf(cabecalhoColunaProvaResultados(resultados));
  const tituloProva = escapeHtmlPdf(tituloProvaResumoPdf(resultados));

  const theadPdf = `<tr><th>${colProva}</th><th class="col-nome">Nome</th><th>NIP</th><th>Tempo</th><th>Nota</th><th>SituaÃ§Ã£o</th><th class="col-rubrica">RÃºbrica</th></tr>`;

  const rows = resultados.map((r) => {
      const papel = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
      const nip = r.nip ? escapeHtmlPdf(r.nip) : 'â€”';
      const nota = escapeHtmlPdf(r.notaTexto ?? 'â€”');
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

  const metaHtml = `Gerado em ${escapeHtmlPdf(dataStr)} Â· <strong>${tituloProva}</strong>`;
  const comAssinatura = Boolean(aplicadorAssinatura?.nome?.trim());

  const conteudoHtml =
    resultados.length === 0
      ? '<p style="color:#9CA3AF;font-weight:700;">Nenhum resultado nesta sessÃ£o.</p>'
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
 * Gera o PDF em silÃªncio e baixa para Downloads (web/iPhone/Android).
 * NÃ£o abre o PDF na tela.
 */
export async function exportResumoAplicacaoPdf(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<string> {
  if (resultados.length === 0) {
    throw new Error('NÃ£o hÃ¡ resultados para salvar.');
  }

  const filename = nomeArquivoPdfResumo(resultados);

  if (Platform.OS === 'web') {
    // iPhone/Safari: html2canvas gera PDF em branco â€” usa jsPDF + download direto.
    const blob = await gerarResumoAplicacaoPdfBlobWeb(resultados, aplicadorAssinatura);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) {
      throw new SalvamentoCanceladoError();
    }
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  // HTML ainda alimenta o print nativo (Android/iOS app).
  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro, undefined, aplicadorAssinatura);

  const { uri } = await printToFileComTimeout({
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

/** Resultado com `prova` preenchida a partir do tipo da sessÃ£o (layout igual ao Salvar). */
export function resultadosSessaoParaResumoPdf(
  sessao: SessaoAplicacaoTaf,
): ResultadoCorridaItem[] {
  return sessao.resultados.map((r) => ({
    ...r,
    prova: r.prova ?? sessao.tipoProva,
  }));
}

/** Blocos de resumo (um por sessÃ£o) em ordem cronolÃ³gica â€” mesmo layout do Salvar. */
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
 * (data do dia selecionado no histÃ³rico, nÃ£o a do salvamento).
 */
export function nomeArquivoPdfResultadosDoDia(dataBr: string): string {
  const dataKey = dataBr.trim().replace(/\//g, '-');
  return sanitizarNomeArquivo(`Resultados_do_dia_${dataKey || formatBrDateKey()}`, '.pdf');
}

/**
 * HTML nativo: um bloco (mesmo do Salvar) ou vÃ¡rios seÃ§Ãµes com quebra de pÃ¡gina.
 */
export function buildResumosAplicacaoDiaHtml(
  blocos: ResumoAplicacaoPdfBloco[],
  tituloDocumento = 'Resultados do dia â€” TAF',
): string {
  if (blocos.length === 0) {
    throw new Error('NÃ£o hÃ¡ resultados para salvar.');
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
    const theadPdf = `<tr><th>${colProva}</th><th class="col-nome">Nome</th><th>NIP</th><th>Tempo</th><th>Nota</th><th>SituaÃ§Ã£o</th><th class="col-rubrica">RÃºbrica</th></tr>`;
    const rows = resultados.map((r) => {
      const papel = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
      const nip = r.nip ? escapeHtmlPdf(r.nip) : 'â€”';
      const nota = escapeHtmlPdf(r.notaTexto ?? 'â€”');
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
      <h2 class="resumo-sessao-titulo">Resumo da aplicaÃ§Ã£o â€” TAF</h2>
      <p class="resumo-sessao-meta">Gerado em ${escapeHtmlPdf(dataStr)} Â· <strong>${tituloProva}</strong></p>
      ${tabela}
      <div class="resumo-sessao-assinatura">${blocoAplicadorAssinaturaHtml(bloco.aplicadorAssinatura)}</div>
    </section>`;
  });

  return buildPdfLandscapeDocument({
    documentTitle: tituloDocumento,
    titulo: tituloDocumento,
    metaHtml: `Gerado em ${escapeHtmlPdf(dataStr)} Â· ${blocos.length} aplicaÃ§Ãµes`,
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
 * Um PDF do dia no formato do Salvar pÃ³s-rÃºbrica (uma seÃ§Ã£o por sessÃ£o).
 */
export async function exportResumosSessoesDiaPdf(
  sessoes: SessaoAplicacaoTaf[],
  dataBr: string,
): Promise<string> {
  const blocos = montarBlocosResumoPdfDasSessoes(sessoes);
  if (blocos.length === 0) {
    throw new Error('NÃ£o hÃ¡ participantes para exportar neste dia.');
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
    `Resultados do dia â€” ${dataBr.trim() || 'TAF'}`,
  );
  const { uri } = await printToFileComTimeout({
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

