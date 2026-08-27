import { Platform } from 'react-native';
import * as Print from 'expo-print';
import {
  isTransporteInstitucional,
  labelTransporteAgendamento,
  type ReservaAgendamento,
} from '../services/reservasAgendamentoStorage';
import {
  MODALIDADE_AGENDAMENTO_LABELS,
  tipoTafDaModalidade,
  TIPO_TAF_AGENDAMENTO_LABELS,
  type SlotAgendamento,
} from '../services/agendamentoStorage';
import { compararAntiguidadeMilitar } from './ordemAntiguidadeMilitar';
import { nomeBareSemPosto } from './formatNomeComPosto';
import { formatNipInput, nipDigitos } from './nipFormat';
import {
  buildPdfLandscapeDocument,
  escapeHtmlPdf,
  PDF_A4_LANDSCAPE_HEIGHT,
  PDF_A4_LANDSCAPE_WIDTH,
  pdfTextoParaJsPdf,
} from './pdfLayout';
import {
  baixarArquivoParaDownloads,
  entregarPdfBlobWeb,
  mensagemSucessoSalvarNaPasta,
  sanitizarNomeArquivo,
  SalvamentoCanceladoError,
} from './salvarArquivoNaPasta';

export type LinhaAgendamentoPdf = {
  posto: string;
  nip: string;
  nome: string;
  transporte: string;
  updatedAt: number;
};

function postoDaReserva(r: ReservaAgendamento): string {
  const direto = (r.posto || r.oficial || r.praca || '').trim();
  if (direto) return direto.toUpperCase();
  const parts = String(r.nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    const first = (parts[0] || '').toUpperCase();
    if (/[0-9°º]/.test(first) || first.length <= 6) return first;
  }
  return '—';
}

export function montarLinhasAgendamentoPdf(
  reservas: ReservaAgendamento[],
): LinhaAgendamentoPdf[] {
  const linhas: LinhaAgendamentoPdf[] = reservas.map((r) => {
    const posto = postoDaReserva(r);
    const nipKey = nipDigitos(r.nip);
    return {
      posto,
      nip: nipKey ? formatNipInput(nipKey) : r.nip || '—',
      nome: nomeBareSemPosto(r.nome || '').trim() || (r.nome || '—').trim(),
      transporte: labelTransporteAgendamento(r.transporte),
      updatedAt: r.updatedAt ?? 0,
    };
  });
  linhas.sort(compararAntiguidadeMilitar);
  return linhas;
}

const EXTRA_STYLES = `
  .hero {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%);
    color: #f8fafc;
    border-radius: 16px;
    padding: 18px 20px;
    margin-bottom: 14px;
  }
  .hero-kicker {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #d4af37;
    font-weight: 800;
    margin-bottom: 6px;
  }
  .hero-title {
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    margin: 0 0 4px;
  }
  .hero-sub {
    font-size: 12px;
    color: #cbd5e1;
    margin: 0;
  }
  .kpi-row {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }
  .kpi {
    flex: 1;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  }
  .kpi .n {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }
  .kpi .l {
    margin-top: 4px;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
  }
  .kpi.gold {
    background: linear-gradient(180deg, #fffbeb 0%, #fff 100%);
    border-color: #fcd34d;
  }
  .kpi.gold .n { color: #b45309; }
  .kpi.gold .l { color: #92400e; }
  .kpi.cyan {
    background: linear-gradient(180deg, #ecfeff 0%, #fff 100%);
    border-color: #67e8f9;
  }
  .kpi.cyan .n { color: #0e7490; }
  .kpi.cyan .l { color: #155e75; }
  table.agendamento-taf {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
  }
  table.agendamento-taf thead { display: table-header-group; }
  table.agendamento-taf th {
    background: #0f172a;
    color: #d4af37;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 10px 8px;
    text-align: center;
    border: 1px solid #1e293b;
  }
  table.agendamento-taf td {
    padding: 8px;
    border: 1px solid #e2e8f0;
    text-align: center;
    vertical-align: middle;
    color: #0f172a;
  }
  table.agendamento-taf td.col-nome { text-align: left; padding-left: 12px; }
  table.agendamento-taf tbody tr:nth-child(even) td { background: #f8fafc; }
  table.agendamento-taf tbody tr:hover td { background: #fffbeb; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; }
  .ord {
    font-weight: 800;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }
`;

export function buildAgendamentoSlotHtml(
  slot: SlotAgendamento,
  linhas: LinhaAgendamentoPdf[],
  reservas?: ReservaAgendamento[],
): string {
  const tipo = TIPO_TAF_AGENDAMENTO_LABELS[tipoTafDaModalidade(slot.modalidade)];
  const modalidade = MODALIDADE_AGENDAMENTO_LABELS[slot.modalidade];
  const geradoEm = new Date().toLocaleString('pt-BR');
  const max = slot.maxParticipantes;
  const agendados = linhas.length;
  const vagas = Math.max(0, max - agendados);
  const transporteInstitucional = (reservas ?? []).filter((r) =>
    isTransporteInstitucional(r.transporte),
  ).length;

  const rows = linhas
    .map(
      (r, i) => `<tr>
      <td class="ord">${i + 1}</td>
      <td><strong>${escapeHtmlPdf(r.posto)}</strong></td>
      <td class="mono">${escapeHtmlPdf(r.nip)}</td>
      <td class="col-nome"><strong>${escapeHtmlPdf(r.nome)}</strong></td>
      <td>${escapeHtmlPdf(r.transporte)}</td>
    </tr>`,
    )
    .join('');

  const body = `
    <div class="hero">
      <div class="hero-kicker">Relação de agendamento · TAF</div>
      <p class="hero-title">${escapeHtmlPdf(modalidade)}</p>
      <p class="hero-sub">${escapeHtmlPdf(tipo)} · Data ${escapeHtmlPdf(slot.data)} · Gerado em ${escapeHtmlPdf(geradoEm)}</p>
    </div>
    <div class="kpi-row">
      <div class="kpi gold"><div class="n">${agendados}</div><div class="l">Agendados</div></div>
      <div class="kpi cyan"><div class="n">${transporteInstitucional}</div><div class="l">Transporte institucional</div></div>
      <div class="kpi"><div class="n">${max}</div><div class="l">Máximo de vagas</div></div>
      <div class="kpi"><div class="n">${vagas}</div><div class="l">Vagas restantes</div></div>
    </div>
    <table class="agendamento-taf">
      <thead>
        <tr>
          <th style="width:7%">Nº</th>
          <th style="width:14%">Posto / Grad.</th>
          <th style="width:14%">NIP</th>
          <th style="width:40%">Nome</th>
          <th style="width:25%">Transporte</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows ||
          `<tr><td colspan="5" style="padding:16px;color:#64748b">Nenhum militar agendado nesta prova.</td></tr>`
        }
      </tbody>
    </table>
  `;

  return buildPdfLandscapeDocument({
    title: `Agendamento TAF — ${modalidade} — ${slot.data}`,
    bodyHtml: body,
    extraStyles: EXTRA_STYLES,
  });
}

async function gerarAgendamentoSlotPdfBlobWeb(
  slot: SlotAgendamento,
  linhas: LinhaAgendamentoPdf[],
  reservas: ReservaAgendamento[],
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pdfTexto = pdfTextoParaJsPdf;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 28;
  const marginTop = 26;
  const marginBottom = 28;
  const usableW = pageW - marginX * 2;
  const tipo = TIPO_TAF_AGENDAMENTO_LABELS[tipoTafDaModalidade(slot.modalidade)];
  const modalidade = MODALIDADE_AGENDAMENTO_LABELS[slot.modalidade];
  const geradoEm = new Date().toLocaleString('pt-BR');
  const max = slot.maxParticipantes;
  const agendados = linhas.length;
  const vagas = Math.max(0, max - agendados);
  const transporteInstitucional = reservas.filter((r) =>
    isTransporteInstitucional(r.transporte),
  ).length;

  type Col = { title: string; w: number; get: (r: LinhaAgendamentoPdf, i: number) => string };
  const cols: Col[] = [
    { title: 'Nº', w: usableW * 0.07, get: (_r, i) => String(i + 1) },
    { title: 'Posto / Grad.', w: usableW * 0.14, get: (r) => r.posto || '—' },
    { title: 'NIP', w: usableW * 0.14, get: (r) => r.nip || '—' },
    { title: 'Nome', w: usableW * 0.40, get: (r) => r.nome || '—' },
    { title: 'Transporte', w: usableW * 0.25, get: (r) => r.transporte || '—' },
  ];

  const drawHeader = (pageIndex: number) => {
    let y = marginTop;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(marginX, y, usableW, 54, 8, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(212, 175, 55);
    doc.text(pdfTexto('RELACAO DE AGENDAMENTO · TAF'), marginX + 14, y + 16);
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfTexto(modalidade), marginX + 14, y + 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(
      pdfTexto(`${tipo} · Data ${slot.data} · Gerado em ${geradoEm}`),
      marginX + 14,
      y + 46,
    );
    if (pageIndex > 0) {
      doc.setTextColor(203, 213, 225);
      doc.text(pdfTexto(`Folha ${pageIndex + 1}`), pageW - marginX - 14, y + 16, {
        align: 'right',
      });
    }
    y += 68;

    if (pageIndex === 0) {
      const kpiW = (usableW - 24) / 4;
      const kpis = [
        { n: String(agendados), l: 'AGENDADOS', tone: 'gold' as const },
        {
          n: String(transporteInstitucional),
          l: 'TRANSP. INSTITUCIONAL',
          tone: 'cyan' as const,
        },
        { n: String(max), l: 'MAXIMO DE VAGAS', tone: 'plain' as const },
        { n: String(vagas), l: 'VAGAS RESTANTES', tone: 'plain' as const },
      ];
      kpis.forEach((k, idx) => {
        const x = marginX + idx * (kpiW + 8);
        if (k.tone === 'gold') {
          doc.setFillColor(255, 251, 235);
          doc.setDrawColor(252, 211, 77);
        } else if (k.tone === 'cyan') {
          doc.setFillColor(236, 254, 255);
          doc.setDrawColor(103, 232, 249);
        } else {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
        }
        doc.setLineWidth(0.8);
        doc.roundedRect(x, y, kpiW, 42, 6, 6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        if (k.tone === 'gold') doc.setTextColor(180, 83, 9);
        else if (k.tone === 'cyan') doc.setTextColor(14, 116, 144);
        else doc.setTextColor(15, 23, 42);
        doc.text(pdfTexto(k.n), x + 12, y + 20);
        doc.setFontSize(7);
        if (k.tone === 'gold') doc.setTextColor(146, 64, 14);
        else if (k.tone === 'cyan') doc.setTextColor(21, 94, 117);
        else doc.setTextColor(100, 116, 139);
        doc.text(pdfTexto(k.l), x + 12, y + 34);
      });
      y += 56;
    }

    const headerH = 20;
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, y, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(212, 175, 55);
    let x = marginX;
    for (const col of cols) {
      doc.text(pdfTexto(col.title), x + col.w / 2, y + 13, {
        align: 'center',
        maxWidth: col.w - 4,
      });
      x += col.w;
    }
    return y + headerH + 4;
  };

  const rowH = 18;
  let pageIndex = 0;
  let y = drawHeader(pageIndex);
  let rowsOnPage = 0;
  const maxRows = Math.max(1, Math.floor((pageH - y - marginBottom) / rowH));

  if (linhas.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfTexto('Nenhum militar agendado nesta prova.'), marginX, y + 16);
  }

  linhas.forEach((linha, index) => {
    if (rowsOnPage >= maxRows) {
      doc.addPage();
      pageIndex += 1;
      y = drawHeader(pageIndex);
      rowsOnPage = 0;
    }
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, usableW, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    let x = marginX;
    const baseline = y + rowH * 0.68;
    cols.forEach((col, ci) => {
      const txt = pdfTexto(col.get(linha, index));
      const align = ci === 3 ? 'left' : 'center';
      const tx = ci === 3 ? x + 8 : x + col.w / 2;
      doc.setFont('helvetica', ci === 0 || ci === 1 ? 'bold' : 'normal');
      doc.text(txt, tx, baseline, { align, maxWidth: col.w - (ci === 3 ? 12 : 4) });
      x += col.w;
    });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, y + rowH - 0.5, pageW - marginX, y + rowH - 0.5);
    y += rowH;
    rowsOnPage += 1;
  });

  return doc.output('blob');
}

export async function exportAgendamentoSlotPdf(
  slot: SlotAgendamento,
  reservas: ReservaAgendamento[],
): Promise<string> {
  const linhas = montarLinhasAgendamentoPdf(reservas);
  const dataSlug = slot.data.replace(/\//g, '-');
  const filename = sanitizarNomeArquivo(
    `TAF_Agendamento_${slot.modalidade}_${dataSlug}`,
    '.pdf',
  );

  if (Platform.OS === 'web') {
    const blob = await gerarAgendamentoSlotPdfBlobWeb(slot, linhas, reservas);
    const resultado = await entregarPdfBlobWeb(blob, filename);
    if (!resultado.ok) throw new SalvamentoCanceladoError();
    return mensagemSucessoSalvarNaPasta(resultado);
  }

  const html = buildAgendamentoSlotHtml(slot, linhas, reservas);
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
    dialogTitle: 'Salvar PDF — Agendamento TAF',
  });
  if (!resultado.ok) throw new SalvamentoCanceladoError();
  return mensagemSucessoSalvarNaPasta(resultado);
}
