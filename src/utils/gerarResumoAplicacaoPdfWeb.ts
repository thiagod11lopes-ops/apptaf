import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { postoGradExibicaoAssinatura } from '../types/aplicadorAssinatura';
import { tituloTipoProva, type TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { RUBRICA_PDF_ALTURA, RUBRICA_PDF_LARGURA } from './rubricaConstants';
import { rubricaSvgParaPdf } from './rubricaSvgNormalize';

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

/** Converte SVG data-URL da rúbrica em PNG para o jsPDF (funciona no iPhone). */
async function svgRubricaParaPngDataUrl(
  svgUri: string | undefined | null,
  widthPx: number,
  heightPx: number,
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const normalized = rubricaSvgParaPdf(svgUri);
  if (!normalized?.startsWith('data:image')) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'sync';
    const fail = () => resolve(null);
    img.onerror = fail;
    img.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(widthPx * scale));
        canvas.height = Math.max(1, Math.round(heightPx * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fail();
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        fail();
      }
    };
    img.src = normalized;
  });
}

/**
 * Gera Blob PDF (A4 paisagem) só com jsPDF — inclui desenhos das rúbricas.
 * Necessário no iPhone/Safari, onde captura HTML costuma sair em branco.
 */
export async function gerarResumoAplicacaoPdfBlobWeb(
  resultados: ResultadoCorridaItem[],
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const rubricaPngByIndex = new Map<number, string>();
  await Promise.all(
    resultados.map(async (r, index) => {
      const png = await svgRubricaParaPngDataUrl(
        r.rubricaCandidatoSvg,
        RUBRICA_PDF_LARGURA,
        RUBRICA_PDF_ALTURA,
      );
      if (png) rubricaPngByIndex.set(index, png);
    }),
  );

  const aplicadorPng = await svgRubricaParaPngDataUrl(
    aplicadorAssinatura?.rubricaSvg,
    RUBRICA_PDF_LARGURA * 1.4,
    RUBRICA_PDF_ALTURA * 1.4,
  );

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 28;
  const marginTop = 28;
  const marginBottom = aplicadorAssinatura ? 58 : 36;
  const usableW = pageW - marginX * 2;

  const tituloProvaLabel = tituloProva(resultados);
  const colProva = cabecalhoColuna(resultados);
  const geradoEm = new Date().toLocaleString('pt-BR');

  const temRubricas = rubricaPngByIndex.size > 0;
  const imgW = RUBRICA_PDF_LARGURA * 0.75;
  const imgH = RUBRICA_PDF_ALTURA * 0.75;
  const rowH = temRubricas ? Math.max(28, imgH + 10) : 18;
  const headerH = 20;

  type Col = { title: string; w: number; kind: 'text' | 'rubrica'; get?: (r: ResultadoCorridaItem) => string };
  const cols: Col[] = [
    { title: colProva, w: usableW * 0.11, kind: 'text', get: (r) => papelLinha(r) },
    { title: 'Nome', w: usableW * 0.26, kind: 'text', get: (r) => r.nome || '—' },
    { title: 'NIP', w: usableW * 0.12, kind: 'text', get: (r) => r.nip || '—' },
    { title: 'Tempo', w: usableW * 0.1, kind: 'text', get: (r) => formatarTempo(r) },
    { title: 'Nota', w: usableW * 0.09, kind: 'text', get: (r) => r.notaTexto || '—' },
    {
      title: 'Situacao',
      w: usableW * 0.14,
      kind: 'text',
      get: (r) => r.reprovacaoTexto || (r.notaTexto === 'REPROVADO' ? 'Reprovado' : 'Aprovado'),
    },
    { title: 'Rubrica', w: usableW * 0.18, kind: 'rubrica' },
  ];

  const sumW = cols.reduce((a, c) => a + c.w, 0);
  cols.forEach((c) => {
    c.w = (c.w / sumW) * usableW;
  });

  const maxRowsPerPage = Math.max(
    1,
    Math.floor((pageH - marginTop - marginBottom - 70) / rowH) - 1,
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

  const drawLinha = (r: ResultadoCorridaItem, index: number, y: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    let x = marginX + 4;
    const textBaseline = y + (temRubricas ? imgH * 0.55 : 0);

    for (const col of cols) {
      if (col.kind === 'rubrica') {
        const png = rubricaPngByIndex.get(index);
        if (png) {
          const drawW = Math.min(imgW, col.w - 8);
          const drawH = imgH * (drawW / imgW);
          const ix = x + (col.w - 8 - drawW) / 2;
          const iy = y - drawH * 0.65;
          try {
            doc.addImage(png, 'PNG', ix, iy, drawW, drawH);
          } catch {
            doc.text(pdfTexto('Assinado'), x, textBaseline, { maxWidth: col.w - 6 });
          }
        } else {
          doc.text(pdfTexto('—'), x, textBaseline, { maxWidth: col.w - 6 });
        }
      } else {
        const raw = pdfTexto(col.get?.(r) ?? '—');
        doc.text(raw, x, textBaseline, { maxWidth: col.w - 6 });
      }
      x += col.w;
    }

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(marginX, y + (temRubricas ? imgH * 0.45 : 6), pageW - marginX, y + (temRubricas ? imgH * 0.45 : 6));
  };

  const drawRodapeAplicador = () => {
    if (!aplicadorAssinatura?.nome?.trim()) return;
    const y = pageH - (aplicadorPng ? 18 : 22);
    doc.setDrawColor(209, 213, 219);
    doc.line(marginX, y - (aplicadorPng ? 42 : 16), pageW - marginX, y - (aplicadorPng ? 42 : 16));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const posto = postoGradExibicaoAssinatura(aplicadorAssinatura);
    const linha = `Aplicador: ${aplicadorAssinatura.nome} · ${posto} · NIP ${aplicadorAssinatura.nip || '—'}`;
    doc.text(pdfTexto(linha), pageW / 2, y - (aplicadorPng ? 28 : 0), {
      align: 'center',
      maxWidth: usableW,
    });
    if (aplicadorPng) {
      const aw = imgW * 1.2;
      const ah = imgH * 1.2;
      try {
        doc.addImage(aplicadorPng, 'PNG', (pageW - aw) / 2, y - ah + 4, aw, ah);
      } catch {
        // ignore
      }
    }
  };

  let pageIndex = 0;
  let y = drawCabecalhoPagina(pageIndex);
  let rowsOnPage = 0;

  for (let index = 0; index < resultados.length; index += 1) {
    const r = resultados[index]!;
    if (rowsOnPage >= maxRowsPerPage) {
      drawRodapeAplicador();
      doc.addPage();
      pageIndex += 1;
      y = drawCabecalhoPagina(pageIndex);
      rowsOnPage = 0;
    }
    drawLinha(r, index, y);
    y += rowH;
    rowsOnPage += 1;
  }

  drawRodapeAplicador();

  return doc.output('blob');
}
