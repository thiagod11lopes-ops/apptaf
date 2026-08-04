import { Platform } from 'react-native';
import * as Print from 'expo-print';
import type { ConcluidoTafItem } from './pendenciasTafHistorico';
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
import { gerarConcluidosTafPdfBlobWeb } from './gerarConcluidosTafPdfWeb';

function chipHtml(label: string): string {
  return `<span class="chip chip-ok">${escapeHtmlPdf(label)} ✓</span>`;
}

const CONCLUIDOS_EXTRA_STYLES = `
  table.concluidos-taf {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    background: #fff;
  }
  table.concluidos-taf thead {
    display: table-header-group;
  }
  table.concluidos-taf th {
    background: #dcfce7;
    color: #166534;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 6px;
    text-align: center;
    vertical-align: middle;
    border: 1px solid #86efac;
  }
  table.concluidos-taf td {
    padding: 7px 6px;
    border: 1px solid #e2e8f0;
    text-align: center;
    vertical-align: middle;
  }
  table.concluidos-taf th.col-nome,
  table.concluidos-taf td.col-nome {
    white-space: nowrap;
    text-align: center;
  }
  table.concluidos-taf tbody tr:nth-child(even) td {
    background: #f0fdf4;
  }
  .mono { font-family: ui-monospace, monospace; font-weight: 700; }
  .chip {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    margin: 1px 2px;
  }
  .chip-ok { background: #dcfce7; color: #166534; }
  .chips { white-space: nowrap; }
  .badge-ok {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 800;
    background: #dcfce7;
    color: #166534;
  }
  .kpi-row {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .kpi {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 10px;
    padding: 8px 12px;
    min-width: 100px;
  }
  .kpi .n {
    font-size: 20px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: #166534;
  }
  .kpi .l {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin-top: 4px;
  }
`;

/** HTML nativo — sem assinatura de aplicador. */
export function buildConcluidosTafHtml(itens: ConcluidoTafItem[]): string {
  const dataStr = new Date().toLocaleString('pt-BR');

  const rows = itens.map(
    (r) => `<tr>
        <td class="mono">${escapeHtmlPdf(r.nip)}</td>
        <td class="col-nome"><strong>${escapeHtmlPdf(r.nome)}</strong></td>
        <td>${escapeHtmlPdf(r.postoGrad)}</td>
        <td>${escapeHtmlPdf(r.categoria)}</td>
        <td><span class="badge-ok">Concluído</span></td>
        <td class="chips">${chipHtml('Corrida')} ${chipHtml('Natação')} ${chipHtml('Perm.')}</td>
      </tr>`,
  );

  const kpiHtml = `
    <div class="kpi-row">
      <div class="kpi"><div class="n">${itens.length}</div><div class="l">Militares concluídos</div></div>
    </div>`;

  const theadHtml = `<tr>
          <th>NIP</th>
          <th class="col-nome">Nome</th>
          <th>P/G</th>
          <th>Categoria</th>
          <th>Situação</th>
          <th>Modalidades</th>
        </tr>`;

  const conteudoHtml = buildPdfTableHtml({
    tableClass: 'concluidos-taf',
    theadHtml,
    rowHtml: rows,
    emptyColspan: 6,
    emptyMessage: 'Nenhum registro',
    leadingHtml: kpiHtml,
  });

  return buildPdfLandscapeDocument({
    documentTitle: 'TAF Concluído — Relatório',
    titulo: 'Militares com TAF concluído',
    metaHtml: `Relatório de militares que concluíram todas as modalidades do TAF · Gerado em ${escapeHtmlPdf(dataStr)}`,
    conteudoHtml,
    extraStyles: CONCLUIDOS_EXTRA_STYLES,
  });
}

/**
 * Baixa o PDF de concluídos (sem abrir nova aba; sem assinatura de aplicador).
 */
export async function exportConcluidosTafPdf(itens: ConcluidoTafItem[]): Promise<string> {
  if (itens.length === 0) {
    throw new Error('Não há militares com TAF concluído para exportar.');
  }

  const filename = sanitizarNomeArquivo(`TAF_Concluido_${formatBrDateKey()}`, '.pdf');

  if (Platform.OS === 'web') {
    const blob = await gerarConcluidosTafPdfBlobWeb(itens);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) throw new SalvamentoCanceladoError();
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildConcluidosTafHtml(itens);
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
    dialogTitle: 'Salvar PDF — TAF Concluído',
  });
  if (!resultado.ok) throw new SalvamentoCanceladoError();
  return mensagemSucessoSalvarNaPasta(resultado);
}
