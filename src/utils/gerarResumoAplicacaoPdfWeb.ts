import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { postoGradExibicaoAssinatura } from '../types/aplicadorAssinatura';
import { tituloTipoProva, type TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality } from '../taf/tafTimeFormat';

function tituloProva(resultados: ResultadoCorridaItem[]): string {
  const prova = resultados.find((r) => r.prova)?.prova ?? 'corrida';
  return tituloTipoProva(prova as TipoProvaAplicada);
}

function cabecalhoColuna(resultados: ResultadoCorridaItem[]): string {
  const temNatacao = resultados.some((r) => r.prova === 'natacao');
  const temCorrida = resultados.some((r) => r.prova !== 'natacao');
  if (temNatacao && !temCorrida) return 'Nadador';
  if (temCorrida && !temNatacao) return 'Corredor';
  return 'Corredor / Nadador';
}

/** Helvetica do jsPDF não cobre acentos — normaliza para exibição legível no PDF. */
function pdfTexto(valor: string): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·•]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?');
}

function formatarTempo(r: ResultadoCorridaItem): string {
  if (r.desempenhoTexto?.trim()) return r.desempenhoTexto.trim();
  const prova = r.prova ?? 'corrida';
  if (prova === 'corrida' || prova === 'natacao') {
    return formatMsByModality(prova, r.tempoMs);
  }
  if (Number.isFinite(r.tempoMs) && r.tempoMs > 0) {
    return formatMsByModality('corrida', r.tempoMs);
  }
  return '—';
}

function papelLinha(r: ResultadoCorridaItem): string {
  const label = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
  return `${label} ${r.corredor}`;
}

/**
 * Gera Blob PDF (A4 paisagem) só com jsPDF — sem html2canvas.
 * Necessário no iPhone/Safari, onde captura de HTML costuma sair em branco.
 */
export async function gerarResumoAplicacaoPdfBlobWeb(
  resultados: ResultadoCorridaItem[],
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 28;
  const marginTop = 28;
  const marginBottom = 36;
  const usableW = pageW - marginX * 2;

  const tituloProvaLabel = tituloProva(resultados);
  const colProva = cabecalhoColuna(resultados);
  const geradoEm = new Date().toLocaleString('pt-BR');

  // Colunas: proporções da tabela do resumo
  const cols: Array<{ title: string; w: number; get: (r: ResultadoCorridaItem) => string }> = [
    {
      title: colProva,
      w: usableW * 0.12,
      get: (r) => papelLinha(r),
    },
    {
      title: 'Nome',
      w: usableW * 0.28,
      get: (r) => r.nome || '—',
    },
    {
      title: 'NIP',
      w: usableW * 0.12,
      get: (r) => r.nip || '—',
    },
    {
      title: 'Tempo',
      w: usableW * 0.1,
      get: (r) => formatarTempo(r),
    },
    {
      title: 'Nota',
      w: usableW * 0.1,
      get: (r) => r.notaTexto || '—',
    },
    {
      title: 'Situacao',
      w: usableW * 0.14,
      get: (r) =>
        r.reprovacaoTexto || (r.notaTexto === 'REPROVADO' ? 'Reprovado' : 'Aprovado'),
    },
    {
      title: 'Rubrica',
      w: usableW * 0.14,
      get: (r) => (r.rubricaCandidatoSvg || r.rubricaCandidato ? 'Assinado' : '—'),
    },
  ];

  // Ajuste fino para somar exatamente usableW
  const sumW = cols.reduce((a, c) => a + c.w, 0);
  cols.forEach((c) => {
    c.w = (c.w / sumW) * usableW;
  });

  const rowH = 18;
  const headerH = 20;
  const maxRowsPerPage = Math.max(
    1,
    Math.floor((pageH - marginTop - marginBottom - 70 - (aplicadorAssinatura ? 48 : 0)) / rowH) - 1,
  );

  const drawCabecalhoPagina = (pageIndex: number) => {
    let y = marginTop;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text(pdfTexto('Resumo da aplicacao — TAF'), marginX, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(pdfTexto(`Gerado em ${geradoEm} · ${tituloProvaLabel}`), marginX, y);
    if (pageIndex > 0) {
      doc.text(pdfTexto(`Folha ${pageIndex + 1}`), pageW - marginX, y, { align: 'right' });
    }
    y += 14;
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageW - marginX, y);
    y += 12;

    // Cabeçalho da tabela
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX, y - 12, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    let x = marginX + 4;
    for (const col of cols) {
      doc.text(pdfTexto(col.title), x, y, { maxWidth: col.w - 6 });
      x += col.w;
    }
    return y + 10;
  };

  const drawLinha = (r: ResultadoCorridaItem, y: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    let x = marginX + 4;
    for (const col of cols) {
      const raw = pdfTexto(col.get(r));
      doc.text(raw, x, y, { maxWidth: col.w - 6 });
      x += col.w;
    }
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(marginX, y + 6, pageW - marginX, y + 6);
  };

  const drawRodapeAplicador = () => {
    if (!aplicadorAssinatura?.nome?.trim()) return;
    const y = pageH - 22;
    doc.setDrawColor(209, 213, 219);
    doc.line(marginX, y - 16, pageW - marginX, y - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const posto = postoGradExibicaoAssinatura(aplicadorAssinatura);
    const linha = `Aplicador: ${aplicadorAssinatura.nome} · ${posto} · NIP ${aplicadorAssinatura.nip || '—'}${
      aplicadorAssinatura.rubricaSvg ? ' · Rubrica registrada' : ''
    }`;
    doc.text(pdfTexto(linha), pageW / 2, y, { align: 'center', maxWidth: usableW });
  };

  let pageIndex = 0;
  let y = drawCabecalhoPagina(pageIndex);
  let rowsOnPage = 0;

  for (const r of resultados) {
    if (rowsOnPage >= maxRowsPerPage) {
      drawRodapeAplicador();
      doc.addPage();
      pageIndex += 1;
      y = drawCabecalhoPagina(pageIndex);
      rowsOnPage = 0;
    }
    drawLinha(r, y);
    y += rowH;
    rowsOnPage += 1;
  }

  drawRodapeAplicador();

  return doc.output('blob');
}
