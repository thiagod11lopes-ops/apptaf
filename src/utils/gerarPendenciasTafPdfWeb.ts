import type { PendenciaTafItem } from './pendenciasTafHistorico';
import {
  FILTRO_PENDENCIA_LABEL,
  type FiltroPendenciaTaf,
} from './pendenciasTafHistorico';
import { pdfTextoParaJsPdf } from './pdfLayout';

const pdfTexto = pdfTextoParaJsPdf;

/** PDF A4 paisagem de pendências — sem assinatura de aplicador. */
export async function gerarPendenciasTafPdfBlobWeb(
  itens: PendenciaTafItem[],
  filtro: FiltroPendenciaTaf,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 28;
  const marginTop = 28;
  const marginBottom = 28;
  const usableW = pageW - marginX * 2;
  const rowH = 16;
  const headerH = 18;
  const geradoEm = new Date().toLocaleString('pt-BR');
  const titulo = FILTRO_PENDENCIA_LABEL[filtro];

  type Col = { title: string; w: number; get: (r: PendenciaTafItem) => string };
  const cols: Col[] = [
    { title: 'NIP', w: usableW * 0.16, get: (r) => r.nip || '—' },
    { title: 'Nome', w: usableW * 0.36, get: (r) => r.nome || '—' },
    { title: 'P/G', w: usableW * 0.1, get: (r) => r.postoGrad || '—' },
    { title: 'Categoria', w: usableW * 0.14, get: (r) => r.categoria || '—' },
    { title: 'Pendencias', w: usableW * 0.24, get: (r) => r.faltam.join(', ') || '—' },
  ];
  const sumW = cols.reduce((a, c) => a + c.w, 0);
  cols.forEach((c) => {
    c.w = (c.w / sumW) * usableW;
  });

  const maxRows = Math.max(1, Math.floor((pageH - marginTop - marginBottom - 70) / rowH) - 1);

  const drawCabecalho = (pageIndex: number) => {
    let y = marginTop;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text(pdfTexto(titulo), marginX, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(
      pdfTexto(`Relatorio de pendencias TAF · ${itens.length} militares · Gerado em ${geradoEm}`),
      marginX,
      y,
    );
    if (pageIndex > 0) {
      doc.text(pdfTexto(`Folha ${pageIndex + 1}`), pageW - marginX, y, { align: 'right' });
    }
    y += 14;
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageW - marginX, y);
    y += 8;

    if (pageIndex === 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(pdfTexto(`Total listado: ${itens.length}`), marginX, y + 10);
      y += 20;
    }

    const yCab = y + 12;
    doc.setFillColor(232, 238, 245);
    doc.rect(marginX, y, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    let x = marginX;
    for (const col of cols) {
      doc.text(pdfTexto(col.title), x + col.w / 2, yCab, {
        align: 'center',
        maxWidth: col.w - 4,
      });
      x += col.w;
    }
    return y + headerH + 4;
  };

  let pageIndex = 0;
  let y = drawCabecalho(pageIndex);
  let rowsOnPage = 0;

  for (const item of itens) {
    if (rowsOnPage >= maxRows) {
      doc.addPage();
      pageIndex += 1;
      y = drawCabecalho(pageIndex);
      rowsOnPage = 0;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    let x = marginX;
    const baseline = y + rowH * 0.7;
    for (const col of cols) {
      doc.text(pdfTexto(col.get(item)), x + col.w / 2, baseline, {
        align: 'center',
        maxWidth: col.w - 4,
      });
      x += col.w;
    }
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(marginX, y + rowH - 1, pageW - marginX, y + rowH - 1);
    y += rowH;
    rowsOnPage += 1;
  }

  return doc.output('blob');
}
