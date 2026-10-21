import type { ReprovadoInicioTafItem } from './resultadoGeralHistorico';
import { textoModalidadeReprovada } from './resultadoGeralHistorico';
import { pdfTextoParaJsPdf } from './pdfLayout';

const pdfTexto = pdfTextoParaJsPdf;

function modalidadesLinhas(item: ReprovadoInicioTafItem): string[] {
  if (item.modalidades.length === 0) return ['Reprovado'];
  return item.modalidades.map(textoModalidadeReprovada);
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

/** PDF A4 paisagem — relação moderna e organizada dos reprovados. */
export async function gerarReprovadosTafPdfBlobWeb(
  itens: ReprovadoInicioTafItem[],
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 24;
  const marginBottom = 36;
  const usableW = pageW - marginX * 2;
  const geradoEm = new Date().toLocaleString('pt-BR');
  const porModalidade = contarPorModalidade(itens);

  type Col = {
    title: string;
    w: number;
    align: 'left' | 'center';
    get: (r: ReprovadoInicioTafItem, index: number) => string | string[];
  };

  const cols: Col[] = [
    { title: '#', w: usableW * 0.05, align: 'center', get: (_r, i) => String(i + 1).padStart(2, '0') },
    { title: 'P/G', w: usableW * 0.1, align: 'center', get: (r) => r.postoGrad || '—' },
    { title: 'NIP', w: usableW * 0.12, align: 'center', get: (r) => r.nip || '—' },
    { title: 'Nome', w: usableW * 0.26, align: 'left', get: (r) => r.nome || '—' },
    { title: 'Categoria', w: usableW * 0.1, align: 'center', get: (r) => r.categoria || '—' },
    {
      title: 'Modalidades reprovadas',
      w: usableW * 0.37,
      align: 'left',
      get: (r) => modalidadesLinhas(r),
    },
  ];
  const sumW = cols.reduce((a, c) => a + c.w, 0);
  cols.forEach((c) => {
    c.w = (c.w / sumW) * usableW;
  });

  const drawFooter = (pageIndex: number, totalPages: number) => {
    const y = pageH - 18;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, y - 10, pageW - marginX, y - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfTexto('AppTAF · Relacao de reprovados no TAF'), marginX, y);
    doc.text(pdfTexto(`Folha ${pageIndex + 1} / ${totalPages}`), pageW - marginX, y, {
      align: 'right',
    });
  };

  const drawHero = (pageIndex: number): number => {
    const heroH = pageIndex === 0 ? 78 : 52;
    doc.setFillColor(127, 29, 29);
    doc.rect(0, 0, pageW, heroH, 'F');
    doc.setFillColor(185, 28, 28);
    doc.rect(0, heroH - 6, pageW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(254, 202, 202);
    doc.text(pdfTexto('INICIAR · TAF'), marginX, 22);

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfTexto('Relacao de militares reprovados'), marginX, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(254, 226, 226);
    doc.text(
      pdfTexto(
        pageIndex === 0
          ? `Reprovados em pelo menos um teste · Gerado em ${geradoEm}`
          : `Continuacao · Gerado em ${geradoEm}`,
      ),
      marginX,
      heroH - 14,
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfTexto(`${itens.length} militares`), pageW - marginX, 42, { align: 'right' });

    return heroH + 14;
  };

  const drawKpis = (startY: number): number => {
    let y = startY;
    const boxH = 42;
    const gap = 8;
    const cards: Array<{ n: string; l: string; accent: [number, number, number] }> = [
      {
        n: String(itens.length),
        l: 'Militares reprovados',
        accent: [185, 28, 28],
      },
      {
        n: String(porModalidade.reduce((a, m) => a + m.count, 0)),
        l: 'Reprovacoes (provas)',
        accent: [220, 38, 38],
      },
      ...porModalidade.slice(0, 4).map((m) => ({
        n: String(m.count),
        l: m.label,
        accent: [153, 27, 27] as [number, number, number],
      })),
    ];

    const cardW = Math.min(130, (usableW - gap * (Math.min(cards.length, 6) - 1)) / Math.min(cards.length, 6));
    let x = marginX;
    for (const card of cards.slice(0, 6)) {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(252, 165, 165);
      doc.setLineWidth(0.8);
      doc.roundedRect(x, y, cardW, boxH, 6, 6, 'FD');
      doc.setFillColor(...card.accent);
      doc.rect(x, y, 4, boxH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...card.accent);
      doc.text(pdfTexto(card.n), x + 12, y + 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(127, 29, 29);
      doc.text(pdfTexto(card.l), x + 12, y + 32, { maxWidth: cardW - 18 });
      x += cardW + gap;
    }
    return y + boxH + 14;
  };

  const drawTableHeader = (y: number): number => {
    const headerH = 22;
    doc.setFillColor(127, 29, 29);
    doc.roundedRect(marginX, y, usableW, headerH, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let x = marginX;
    for (const col of cols) {
      const tx =
        col.align === 'left'
          ? x + 8
          : x + col.w / 2;
      doc.text(pdfTexto(col.title), tx, y + 14, {
        align: col.align === 'left' ? 'left' : 'center',
        maxWidth: col.w - 10,
      });
      x += col.w;
    }
    return y + headerH + 2;
  };

  const measureRowH = (item: ReprovadoInicioTafItem, index: number): number => {
    let lines = 1;
    for (const col of cols) {
      const value = col.get(item, index);
      if (Array.isArray(value)) {
        lines = Math.max(lines, value.length);
      } else {
        const wrapped = doc.splitTextToSize(pdfTexto(value), col.w - 12);
        lines = Math.max(lines, wrapped.length);
      }
    }
    return Math.max(22, 10 + lines * 11);
  };

  const drawRow = (item: ReprovadoInicioTafItem, index: number, y: number, rowH: number) => {
    if (index % 2 === 0) {
      doc.setFillColor(255, 251, 251);
      doc.rect(marginX, y, usableW, rowH, 'F');
    } else {
      doc.setFillColor(254, 242, 242);
      doc.rect(marginX, y, usableW, rowH, 'F');
    }
    doc.setDrawColor(254, 202, 202);
    doc.setLineWidth(0.4);
    doc.line(marginX, y + rowH, pageW - marginX, y + rowH);

    let x = marginX;
    for (const col of cols) {
      const value = col.get(item, index);
      doc.setFont('helvetica', col.title === 'Nome' || col.title === '#' ? 'bold' : 'normal');
      doc.setFontSize(col.title === 'Modalidades reprovadas' ? 7.5 : 8);
      doc.setTextColor(col.title === '#' ? 185 : 30, col.title === '#' ? 28 : 41, col.title === '#' ? 28 : 59);

      if (Array.isArray(value)) {
        let ly = y + 12;
        for (const line of value) {
          doc.setFillColor(254, 226, 226);
          const tw = Math.min(col.w - 14, doc.getTextWidth(pdfTexto(line)) + 10);
          doc.roundedRect(x + 6, ly - 8, tw, 11, 3, 3, 'F');
          doc.setTextColor(153, 27, 27);
          doc.text(pdfTexto(line), x + 11, ly, { maxWidth: col.w - 16 });
          ly += 12;
        }
      } else {
        const lines = doc.splitTextToSize(pdfTexto(value), col.w - 12);
        const tx = col.align === 'left' ? x + 8 : x + col.w / 2;
        doc.text(lines, tx, y + 13, {
          align: col.align === 'left' ? 'left' : 'center',
        });
      }
      x += col.w;
    }
  };

  let pageIndex = 0;
  let y = drawHero(pageIndex);
  if (pageIndex === 0) y = drawKpis(y);
  y = drawTableHeader(y);

  for (let i = 0; i < itens.length; i += 1) {
    const item = itens[i]!;
    const rowH = measureRowH(item, i);
    if (y + rowH > pageH - marginBottom) {
      doc.addPage();
      pageIndex += 1;
      y = drawHero(pageIndex);
      y = drawTableHeader(y);
    }
    drawRow(item, i, y, rowH);
    y += rowH;
  }

  const totalPages = pageIndex + 1;
  for (let p = 0; p < totalPages; p += 1) {
    doc.setPage(p + 1);
    drawFooter(p, totalPages);
  }

  return doc.output('blob');
}
