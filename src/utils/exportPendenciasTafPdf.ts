import { Platform } from 'react-native';
import * as Print from 'expo-print';
import {
  FILTRO_PENDENCIA_LABEL,
  type FiltroPendenciaTaf,
  type PendenciaTafItem,
} from './pendenciasTafHistorico';
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
import { gerarPendenciasTafPdfBlobWeb } from './gerarPendenciasTafPdfWeb';

const PENDENCIAS_EXTRA_STYLES = `
  table.pendencias-taf {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    background: #fff;
  }
  table.pendencias-taf thead {
    display: table-header-group;
  }
  table.pendencias-taf th {
    background: #e8eef5;
    color: #334155;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 6px;
    text-align: center;
    vertical-align: middle;
    border: 1px solid #cbd5e1;
  }
  table.pendencias-taf td {
    padding: 7px 6px;
    border: 1px solid #e2e8f0;
    text-align: center;
    vertical-align: middle;
  }
  table.pendencias-taf th.col-nome,
  table.pendencias-taf td.col-nome {
    white-space: nowrap;
    text-align: center;
  }
  table.pendencias-taf tbody tr:nth-child(even) td {
    background: #fafbfc;
  }
  .mono { font-family: ui-monospace, monospace; font-weight: 700; }
  .falta { color: #dc2626; font-weight: 700; font-size: 10px; }
  .badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 800;
  }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .badge-muted { background: #f1f5f9; color: #64748b; }
  .kpi-row {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .kpi {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px 12px;
    min-width: 100px;
  }
  .kpi .n {
    font-size: 20px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
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
export function buildPendenciasTafHtml(
  itens: PendenciaTafItem[],
  filtro: FiltroPendenciaTaf,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const tituloFiltro = FILTRO_PENDENCIA_LABEL[filtro];

  const rows = itens.map(
    (r) => `<tr>
        <td class="mono">${escapeHtmlPdf(r.nip)}</td>
        <td class="col-nome"><strong>${escapeHtmlPdf(r.nome)}</strong></td>
        <td>${escapeHtmlPdf(r.postoGrad)}</td>
        <td>${escapeHtmlPdf(r.categoria)}</td>
        <td><span class="badge badge-${r.situacao === 'Sem teste' ? 'muted' : 'warn'}">${escapeHtmlPdf(r.situacao)}</span></td>
        <td class="falta">${escapeHtmlPdf(r.faltam.join(', ') || '—')}</td>
      </tr>`,
  );

  const kpiHtml = `
    <div class="kpi-row">
      <div class="kpi"><div class="n">${itens.length}</div><div class="l">Militares listados</div></div>
      <div class="kpi"><div class="n">${itens.filter((i) => i.situacao === 'Sem teste').length}</div><div class="l">Sem teste</div></div>
      <div class="kpi"><div class="n">${itens.filter((i) => i.situacao === 'Parcial').length}</div><div class="l">Parcial</div></div>
    </div>`;

  const theadHtml = `<tr>
          <th>NIP</th>
          <th class="col-nome">Nome</th>
          <th>P/G</th>
          <th>Categoria</th>
          <th>Situação</th>
          <th>Pendências</th>
        </tr>`;

  const conteudoHtml = buildPdfTableHtml({
    tableClass: 'pendencias-taf',
    theadHtml,
    rowHtml: rows,
    emptyColspan: 6,
    emptyMessage: 'Nenhum registro',
    leadingHtml: kpiHtml,
  });

  return buildPdfLandscapeDocument({
    documentTitle: `${tituloFiltro} — TAF`,
    titulo: tituloFiltro,
    metaHtml: `Relatório de pendências do Teste de Aptidão Física · Gerado em ${escapeHtmlPdf(dataStr)}`,
    conteudoHtml,
    extraStyles: PENDENCIAS_EXTRA_STYLES,
  });
}

function nomeArquivoPendencias(filtro: FiltroPendenciaTaf): string {
  const base = sanitizarNomeArquivo(FILTRO_PENDENCIA_LABEL[filtro]).replace(/\s+/g, '_');
  return sanitizarNomeArquivo(`${base}_${formatBrDateKey()}`, '.pdf');
}

/**
 * Baixa o PDF de pendências (sem abrir nova aba; sem assinatura de aplicador).
 */
export async function exportPendenciasTafPdf(
  itens: PendenciaTafItem[],
  filtro: FiltroPendenciaTaf,
): Promise<string> {
  if (itens.length === 0) {
    throw new Error('Não há militares com pendência para exportar.');
  }

  const filename = nomeArquivoPendencias(filtro);

  if (Platform.OS === 'web') {
    const blob = await gerarPendenciasTafPdfBlobWeb(itens, filtro);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) throw new SalvamentoCanceladoError();
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildPendenciasTafHtml(itens, filtro);
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
    dialogTitle: `Salvar PDF — ${FILTRO_PENDENCIA_LABEL[filtro]}`,
  });
  if (!resultado.ok) throw new SalvamentoCanceladoError();
  return mensagemSucessoSalvarNaPasta(resultado);
}
