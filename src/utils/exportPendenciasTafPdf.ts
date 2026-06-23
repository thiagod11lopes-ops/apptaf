import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  FILTRO_PENDENCIA_LABEL,
  type FiltroPendenciaTaf,
  type PendenciaTafItem,
} from './pendenciasTafHistorico';

const PDF_A4_WIDTH = 595;
const PDF_A4_HEIGHT = 842;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chipHtml(label: string, ok: boolean): string {
  const bg = ok ? '#dcfce7' : '#fee2e2';
  const color = ok ? '#166534' : '#991b1b';
  const icon = ok ? '✓' : '—';
  return `<span class="chip" style="background:${bg};color:${color}">${escapeHtml(label)} ${icon}</span>`;
}

export function buildPendenciasTafHtml(
  itens: PendenciaTafItem[],
  filtro: FiltroPendenciaTaf,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const tituloFiltro = FILTRO_PENDENCIA_LABEL[filtro];

  const rows = itens
    .map(
      (r) => `<tr>
        <td class="mono">${escapeHtml(r.nip)}</td>
        <td><strong>${escapeHtml(r.nome)}</strong></td>
        <td>${escapeHtml(r.postoGrad)}</td>
        <td>${escapeHtml(r.categoria)}</td>
        <td><span class="badge badge-${r.situacao === 'Sem teste' ? 'muted' : 'warn'}">${escapeHtml(r.situacao)}</span></td>
        <td class="chips">${chipHtml('Corrida', r.temCorrida)} ${chipHtml('Natação', r.temNatacao)} ${chipHtml('Perm.', r.temPermanencia)}</td>
        <td class="falta">${escapeHtml(r.faltam.join(', ') || '—')}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(tituloFiltro)} — TAF</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #f8fafc;
    }
    .hero {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #2563eb 100%);
      color: #fff;
      padding: 28px 32px 24px;
      border-radius: 0 0 20px 20px;
      margin-bottom: 20px;
    }
    .hero h1 {
      margin: 0 0 6px;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .hero .sub {
      margin: 0;
      opacity: 0.88;
      font-size: 13px;
      line-height: 1.45;
    }
    .kpi-row {
      display: flex;
      gap: 12px;
      margin-top: 18px;
      flex-wrap: wrap;
    }
    .kpi {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 14px;
      padding: 10px 16px;
      min-width: 120px;
    }
    .kpi .n {
      font-size: 28px;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .kpi .l {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      opacity: 0.85;
      margin-top: 4px;
    }
    .content { padding: 0 24px 24px; }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
    }
    thead th {
      background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
      color: #334155;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 12px 10px;
      text-align: left;
      border-bottom: 2px solid #cbd5e1;
    }
    tbody td {
      padding: 10px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) td { background: #fafbfc; }
    tbody tr:last-child td { border-bottom: none; }
    .mono { font-family: ui-monospace, monospace; font-weight: 700; }
    .chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 700;
      margin: 1px 2px;
    }
    .chips { white-space: nowrap; }
    .falta { color: #dc2626; font-weight: 700; font-size: 10px; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 800;
    }
    .badge-warn { background: #fef3c7; color: #92400e; }
    .badge-muted { background: #f1f5f9; color: #64748b; }
    .footer {
      margin-top: 16px;
      text-align: center;
      color: #64748b;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>${escapeHtml(tituloFiltro)}</h1>
    <p class="sub">Relatório de pendências do Teste de Aptidão Física · Gerado em ${escapeHtml(dataStr)}</p>
    <div class="kpi-row">
      <div class="kpi"><div class="n">${itens.length}</div><div class="l">Militares listados</div></div>
      <div class="kpi"><div class="n">${itens.filter((i) => i.situacao === 'Sem teste').length}</div><div class="l">Sem teste</div></div>
      <div class="kpi"><div class="n">${itens.filter((i) => i.situacao === 'Parcial').length}</div><div class="l">Parcial</div></div>
    </div>
  </div>
  <div class="content">
    <table>
      <thead>
        <tr>
          <th>NIP</th>
          <th>Nome</th>
          <th>Posto / Grad.</th>
          <th>Categoria</th>
          <th>Situação</th>
          <th>Modalidades</th>
          <th>Pendências</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">Nenhum registro</td></tr>'}</tbody>
    </table>
    <p class="footer">TAF — Sistema de gestão de aptidão física</p>
  </div>
</body>
</html>`;
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
        'Não foi possível abrir a janela de impressão. Permita pop-ups neste site e tente novamente.',
      );
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    width: PDF_A4_WIDTH,
    height: PDF_A4_HEIGHT,
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
