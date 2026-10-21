import { Platform } from 'react-native';
import * as Print from 'expo-print';
import type { ReprovadoInicioTafItem } from './resultadoGeralHistorico';
import { textoModalidadeReprovada } from './resultadoGeralHistorico';
import {
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
    .map((m) => `<span class="chip">${escapeHtmlPdf(textoModalidadeReprovada(m))}</span>`)
    .join('');
}

function contarPorModalidade(itens: ReprovadoInicioTafItem[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of itens) {
    for (const m of item.modalidades) {
      const label = (m.label || 'Outra').trim() || 'Outra';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

const REPROVADOS_EXTRA_STYLES = `
  @page { size: A4 landscape; margin: 10mm; }
  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #0f172a;
    background: #fff;
  }
  .hero {
    background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 55%, #dc2626 100%);
    color: #fff;
    border-radius: 14px;
    padding: 18px 20px 16px;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
  }
  .hero::after {
    content: "";
    position: absolute;
    right: -40px;
    top: -40px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .hero-kicker {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.2px;
    color: #fecaca;
    margin-bottom: 4px;
  }
  .hero-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.3px;
    margin: 0;
  }
  .hero-meta {
    margin-top: 6px;
    font-size: 11px;
    color: #fee2e2;
  }
  .hero-total {
    position: absolute;
    right: 20px;
    top: 22px;
    font-size: 13px;
    font-weight: 800;
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 999px;
    padding: 6px 12px;
  }
  .kpi-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }
  .kpi {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 12px;
    padding: 10px 12px;
    min-width: 110px;
    border-left: 4px solid #b91c1c;
  }
  .kpi .n {
    font-size: 20px;
    font-weight: 800;
    color: #b91c1c;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .kpi .l {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7f1d1d;
    margin-top: 4px;
    font-weight: 700;
  }
  table.reprovados-taf {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 11px;
    background: #fff;
    border: 1px solid #fecaca;
    border-radius: 12px;
    overflow: hidden;
  }
  table.reprovados-taf thead { display: table-header-group; }
  table.reprovados-taf th {
    background: #7f1d1d;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 8px;
    text-align: center;
    border: none;
  }
  table.reprovados-taf th.col-nome,
  table.reprovados-taf th.col-mod { text-align: left; padding-left: 12px; }
  table.reprovados-taf td {
    padding: 9px 8px;
    border-bottom: 1px solid #fecaca;
    text-align: center;
    vertical-align: middle;
  }
  table.reprovados-taf td.col-nome {
    text-align: left;
    padding-left: 12px;
    font-weight: 700;
  }
  table.reprovados-taf td.col-mod {
    text-align: left;
    padding-left: 12px;
  }
  table.reprovados-taf td.col-ord {
    color: #b91c1c;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  table.reprovados-taf tbody tr:nth-child(even) td { background: #fef2f2; }
  table.reprovados-taf tbody tr:nth-child(odd) td { background: #fffbfb; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; }
  .chip {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    margin: 2px 4px 2px 0;
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }
  .footer-note {
    margin-top: 12px;
    font-size: 9px;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }
`;

export function buildReprovadosTafHtml(itens: ReprovadoInicioTafItem[]): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const porModalidade = contarPorModalidade(itens);
  const totalProvas = porModalidade.reduce((a, m) => a + m.count, 0);

  const rows = itens.map(
    (r, index) => `<tr>
        <td class="col-ord">${String(index + 1).padStart(2, '0')}</td>
        <td>${escapeHtmlPdf(r.postoGrad)}</td>
        <td class="mono">${escapeHtmlPdf(r.nip)}</td>
        <td class="col-nome">${escapeHtmlPdf(r.nome)}</td>
        <td>${escapeHtmlPdf(r.categoria)}</td>
        <td class="col-mod">${chipsHtml(r)}</td>
      </tr>`,
  );

  const kpiCards = [
    { n: String(itens.length), l: 'Militares reprovados' },
    { n: String(totalProvas), l: 'Reprovações (provas)' },
    ...porModalidade.slice(0, 4).map((m) => ({ n: String(m.count), l: m.label })),
  ]
    .map(
      (k) =>
        `<div class="kpi"><div class="n">${escapeHtmlPdf(k.n)}</div><div class="l">${escapeHtmlPdf(k.l)}</div></div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>TAF Reprovados — Relatório</title>
  <style>${REPROVADOS_EXTRA_STYLES}</style>
</head>
<body>
  <div class="hero">
    <div class="hero-kicker">INICIAR · TAF</div>
    <h1 class="hero-title">Relação de militares reprovados</h1>
    <div class="hero-meta">Reprovados em pelo menos um teste · Gerado em ${escapeHtmlPdf(dataStr)}</div>
    <div class="hero-total">${itens.length} militares</div>
  </div>
  <div class="kpi-row">${kpiCards}</div>
  <table class="reprovados-taf">
    <thead>
      <tr>
        <th>#</th>
        <th>P/G</th>
        <th>NIP</th>
        <th class="col-nome">Nome</th>
        <th>Categoria</th>
        <th class="col-mod">Modalidades reprovadas</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length > 0 ? rows.join('') : `<tr><td colspan="6">Nenhum registro</td></tr>`}
    </tbody>
  </table>
  <div class="footer-note">
    <span>AppTAF · Relação de reprovados no TAF</span>
    <span>${itens.length} militar${itens.length !== 1 ? 'es' : ''}</span>
  </div>
</body>
</html>`;
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
