import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  FILTRO_PENDENCIA_LABEL,
  type FiltroPendenciaTaf,
  type PendenciaTafItem,
} from './pendenciasTafHistorico';
import {
  buildPdfLandscapeDocument,
  buildPaginatedPdfTableHtml,
  escapeHtmlPdf,
  PDF_A4_LANDSCAPE_HEIGHT,
  PDF_A4_LANDSCAPE_WIDTH,
} from './pdfLayout';

/** Linhas compactas (pendências/concluídos) por folha A4 paisagem. */
const PDF_COMPACT_ROWS_FIRST_PAGE = 10;
const PDF_COMPACT_ROWS_OTHER_PAGE = 14;

function chipHtml(label: string, ok: boolean): string {
  const bg = ok ? '#dcfce7' : '#fee2e2';
  const color = ok ? '#166534' : '#991b1b';
  const icon = ok ? '✓' : '—';
  return `<span class="chip" style="background:${bg};color:${color}">${escapeHtmlPdf(label)} ${icon}</span>`;
}

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
    text-align: left;
    border: 1px solid #cbd5e1;
  }
  table.pendencias-taf td {
    padding: 7px 6px;
    border: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  table.pendencias-taf tbody tr:nth-child(even) td {
    background: #fafbfc;
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
  .chips { white-space: nowrap; }
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

export function buildPendenciasTafHtml(
  itens: PendenciaTafItem[],
  filtro: FiltroPendenciaTaf,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const tituloFiltro = FILTRO_PENDENCIA_LABEL[filtro];

  const rows = itens.map(
      (r) => `<tr>
        <td class="mono">${escapeHtmlPdf(r.nip)}</td>
        <td><strong>${escapeHtmlPdf(r.nome)}</strong></td>
        <td>${escapeHtmlPdf(r.postoGrad)}</td>
        <td>${escapeHtmlPdf(r.categoria)}</td>
        <td><span class="badge badge-${r.situacao === 'Sem teste' ? 'muted' : 'warn'}">${escapeHtmlPdf(r.situacao)}</span></td>
        <td class="chips">${chipHtml('Corrida', r.temCorrida)} ${chipHtml('Natação', r.temNatacao)} ${chipHtml('Perm.', r.temPermanencia)}</td>
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
          <th>Nome</th>
          <th>Posto / Grad.</th>
          <th>Categoria</th>
          <th>Situação</th>
          <th>Modalidades</th>
          <th>Pendências</th>
        </tr>`;

  const conteudoHtml = buildPaginatedPdfTableHtml({
    tableClass: 'pendencias-taf',
    theadHtml,
    rowHtml: rows,
    rowsFirstPage: PDF_COMPACT_ROWS_FIRST_PAGE,
    rowsOtherPage: PDF_COMPACT_ROWS_OTHER_PAGE,
    emptyColspan: 7,
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

export async function exportPendenciasTafPdf(
  itens: PendenciaTafItem[],
  filtro: FiltroPendenciaTaf,
): Promise<void> {
  if (itens.length === 0) {
    throw new Error('Não há militares com pendência para exportar.');
  }

  const html = buildPendenciasTafHtml(itens, filtro);
  const titulo = FILTRO_PENDENCIA_LABEL[filtro];

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
      dialogTitle: `Salvar PDF — ${titulo}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('PDF gerado', 'Arquivo salvo na área de cache do app.');
  }
}
