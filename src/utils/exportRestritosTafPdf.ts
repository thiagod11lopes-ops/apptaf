import { Platform } from 'react-native';
import * as Print from 'expo-print';
import type { RestritoInicioTafItem } from './restritosInicioLista';
import { textoSituacaoRestrito } from './restritosInicioLista';
import {
  buildPdfLandscapeDocument,
  buildPdfTableHtml,
  escapeHtmlPdf,
  PDF_A4_LANDSCAPE_HEIGHT,
  PDF_A4_LANDSCAPE_WIDTH,
} from './pdfLayout';
import {
  baixarArquivoParaDownloads,
  entregarPdfBlobWeb,
  mensagemSucessoSalvarNaPasta,
  sanitizarNomeArquivo,
  SalvamentoCanceladoError,
} from './salvarArquivoNaPasta';
import { formatBrDateKey } from './backupNaming';
import { gerarRestritosTafPdfBlobWeb } from './gerarRestritosTafPdfWeb';

const RESTRITOS_EXTRA_STYLES = `
  table.restritos-taf {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    background: #fff;
  }
  table.restritos-taf thead { display: table-header-group; }
  table.restritos-taf th {
    background: #fef3c7;
    color: #92400e;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 6px;
    text-align: center;
    border: 1px solid #fcd34d;
  }
  table.restritos-taf td {
    padding: 7px 6px;
    border: 1px solid #e2e8f0;
    text-align: center;
    vertical-align: middle;
  }
  table.restritos-taf th.col-nome,
  table.restritos-taf td.col-nome { text-align: center; white-space: nowrap; }
  table.restritos-taf tbody tr:nth-child(even) td { background: #fffbeb; }
  .mono { font-family: ui-monospace, monospace; font-weight: 700; }
  .kpi-row { display: flex; gap: 10px; margin-bottom: 12px; }
  .kpi {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 10px;
    padding: 8px 12px;
    min-width: 100px;
  }
  .kpi .n {
    font-size: 20px;
    font-weight: 800;
    color: #b45309;
    font-variant-numeric: tabular-nums;
  }
  .kpi .l {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #92400e;
    margin-top: 4px;
  }
`;

export function buildRestritosTafHtml(itens: RestritoInicioTafItem[]): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const rows = itens.map(
    (r) => `<tr>
        <td>${escapeHtmlPdf(r.postoGrad)}</td>
        <td class="mono">${escapeHtmlPdf(r.nip)}</td>
        <td class="col-nome"><strong>${escapeHtmlPdf(r.nome)}</strong></td>
        <td>${escapeHtmlPdf(r.dataInicio)}</td>
        <td>${escapeHtmlPdf(r.dataFim)}</td>
        <td>${escapeHtmlPdf(textoSituacaoRestrito(r))}</td>
      </tr>`,
  );

  const kpiHtml = `
    <div class="kpi-row">
      <div class="kpi"><div class="n">${itens.length}</div><div class="l">Militares restritos</div></div>
    </div>`;

  const theadHtml = `<tr>
          <th>P/G</th>
          <th>NIP</th>
          <th class="col-nome">Nome</th>
          <th>Início</th>
          <th>Fim</th>
          <th>Situação</th>
        </tr>`;

  const conteudoHtml = buildPdfTableHtml({
    tableClass: 'restritos-taf',
    theadHtml,
    rowHtml: rows,
    emptyColspan: 6,
    emptyMessage: 'Nenhum registro',
    leadingHtml: kpiHtml,
  });

  return buildPdfLandscapeDocument({
    documentTitle: 'TAF Restritos — Relatório',
    titulo: 'Militares restritos no TAF',
    metaHtml: `Cadastrados como restrito · Gerado em ${escapeHtmlPdf(dataStr)}`,
    conteudoHtml,
    extraStyles: RESTRITOS_EXTRA_STYLES,
  });
}

export async function exportRestritosTafPdf(itens: RestritoInicioTafItem[]): Promise<string> {
  if (itens.length === 0) {
    throw new Error('Não há militares restritos para exportar.');
  }

  const filename = sanitizarNomeArquivo(`TAF_Restritos_${formatBrDateKey()}`, '.pdf');

  if (Platform.OS === 'web') {
    const blob = await gerarRestritosTafPdfBlobWeb(itens);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) throw new SalvamentoCanceladoError();
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildRestritosTafHtml(itens);
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
    dialogTitle: 'Salvar PDF — TAF Restritos',
  });
  if (!resultado.ok) throw new SalvamentoCanceladoError();
  return mensagemSucessoSalvarNaPasta(resultado);
}
