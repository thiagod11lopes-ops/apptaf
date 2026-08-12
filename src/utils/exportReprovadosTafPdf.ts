import { Platform } from 'react-native';
import * as Print from 'expo-print';
import type { ReprovadoInicioTafItem } from './resultadoGeralHistorico';
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
import { gerarReprovadosTafPdfBlobWeb } from './gerarReprovadosTafPdfWeb';

function chipsHtml(item: ReprovadoInicioTafItem): string {
  if (item.modalidades.length === 0) {
    return `<span class="chip">Reprovado</span>`;
  }
  return item.modalidades
    .map((m) => {
      const texto = m.data
        ? `${m.label}: ${m.detalhe} (${m.data})`
        : `${m.label}: ${m.detalhe}`;
      return `<span class="chip">${escapeHtmlPdf(texto)}</span>`;
    })
    .join(' ');
}

function datasHtml(item: ReprovadoInicioTafItem): string {
  const datas = [
    ...new Set(
      item.modalidades.map((m) => m.data).filter((d): d is string => Boolean(d && d.trim())),
    ),
  ];
  return datas.length > 0 ? escapeHtmlPdf(datas.join(' · ')) : '—';
}

const REPROVADOS_EXTRA_STYLES = `
  table.reprovados-taf {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    background: #fff;
  }
  table.reprovados-taf thead { display: table-header-group; }
  table.reprovados-taf th {
    background: #fee2e2;
    color: #991b1b;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 6px;
    text-align: center;
    border: 1px solid #fca5a5;
  }
  table.reprovados-taf td {
    padding: 7px 6px;
    border: 1px solid #e2e8f0;
    text-align: center;
    vertical-align: middle;
  }
  table.reprovados-taf th.col-nome,
  table.reprovados-taf td.col-nome { text-align: center; white-space: nowrap; }
  table.reprovados-taf tbody tr:nth-child(even) td { background: #fef2f2; }
  .mono { font-family: ui-monospace, monospace; font-weight: 700; }
  .chip {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    margin: 1px 2px;
    background: #fee2e2;
    color: #991b1b;
  }
  .chips { white-space: normal; }
  .kpi-row { display: flex; gap: 10px; margin-bottom: 12px; }
  .kpi {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 10px;
    padding: 8px 12px;
    min-width: 100px;
  }
  .kpi .n {
    font-size: 20px;
    font-weight: 800;
    color: #b91c1c;
    font-variant-numeric: tabular-nums;
  }
  .kpi .l {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7f1d1d;
    margin-top: 4px;
  }
`;

export function buildReprovadosTafHtml(itens: ReprovadoInicioTafItem[]): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const rows = itens.map(
    (r) => `<tr>
        <td class="mono">${escapeHtmlPdf(r.nip)}</td>
        <td class="col-nome"><strong>${escapeHtmlPdf(r.nome)}</strong></td>
        <td>${escapeHtmlPdf(r.postoGrad)}</td>
        <td>${escapeHtmlPdf(r.categoria)}</td>
        <td class="chips">${chipsHtml(r)}</td>
        <td class="mono">${datasHtml(r)}</td>
      </tr>`,
  );

  const kpiHtml = `
    <div class="kpi-row">
      <div class="kpi"><div class="n">${itens.length}</div><div class="l">Militares reprovados</div></div>
    </div>`;

  const theadHtml = `<tr>
          <th>NIP</th>
          <th class="col-nome">Nome</th>
          <th>P/G</th>
          <th>Categoria</th>
          <th>Modalidades reprovadas</th>
          <th>Data do teste</th>
        </tr>`;

  const conteudoHtml = buildPdfTableHtml({
    tableClass: 'reprovados-taf',
    theadHtml,
    rowHtml: rows,
    emptyColspan: 6,
    emptyMessage: 'Nenhum registro',
    leadingHtml: kpiHtml,
  });

  return buildPdfLandscapeDocument({
    documentTitle: 'TAF Reprovados — Relatório',
    titulo: 'Militares reprovados no TAF',
    metaHtml: `Reprovados em pelo menos um teste · Gerado em ${escapeHtmlPdf(dataStr)}`,
    conteudoHtml,
    extraStyles: REPROVADOS_EXTRA_STYLES,
  });
}

export async function exportReprovadosTafPdf(itens: ReprovadoInicioTafItem[]): Promise<string> {
  if (itens.length === 0) {
    throw new Error('Não há militares reprovados para exportar.');
  }

  const filename = sanitizarNomeArquivo(`TAF_Reprovados_${formatBrDateKey()}`, '.pdf');

  if (Platform.OS === 'web') {
    const blob = await gerarReprovadosTafPdfBlobWeb(itens);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) throw new SalvamentoCanceladoError();
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildReprovadosTafHtml(itens);
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
    dialogTitle: 'Salvar PDF — TAF Reprovados',
  });
  if (!resultado.ok) throw new SalvamentoCanceladoError();
  return mensagemSucessoSalvarNaPasta(resultado);
}
