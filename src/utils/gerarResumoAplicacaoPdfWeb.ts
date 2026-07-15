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

/** Decodifica data-URL SVG (utf8 ou base64) para string SVG. */
export function decodeSvgDataUrl(svgUri: string): string | null {
  const normalized = rubricaSvgParaPdf(svgUri) ?? svgUri.trim();
  if (!normalized.startsWith('data:image/svg')) return null;

  const comma = normalized.indexOf(',');
  if (comma < 0) return null;
  const meta = normalized.slice(0, comma);
  const data = normalized.slice(comma + 1);

  try {
    if (/;base64/i.test(meta)) {
      const binary = atob(data);
      // UTF-8 safe decode
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    }
    return decodeURIComponent(data);
  } catch {
    try {
      return decodeURIComponent(data);
    } catch {
      return null;
    }
  }
}

function extrairPathsDoSvg(svg: string): { paths: string[]; vbW: number; vbH: number } {
  const vbMatch = svg.match(/viewBox=["']0\s+0\s+([\d.]+)\s+([\d.]+)["']/i);
  const wMatch = svg.match(/\bwidth=["']([\d.]+)["']/i);
  const hMatch = svg.match(/\bheight=["']([\d.]+)["']/i);
  const vbW = vbMatch ? parseFloat(vbMatch[1]!) : parseFloat(wMatch?.[1] ?? '420');
  const vbH = vbMatch ? parseFloat(vbMatch[2]!) : parseFloat(hMatch?.[1] ?? '180');

  const paths: string[] = [];
  const re = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    if (m[1]?.trim()) paths.push(m[1].trim());
  }
  return {
    paths,
    vbW: Number.isFinite(vbW) && vbW > 0 ? vbW : 420,
    vbH: Number.isFinite(vbH) && vbH > 0 ? vbH : 180,
  };
}

/** Desenha path SVG simples (M/L) no canvas — compatível com rúbricas TAF. */
function strokePathManual(ctx: CanvasRenderingContext2D, d: string): void {
  const tokens = d.match(/[MLml]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return;

  ctx.beginPath();
  let cmd = 'M';
  let i = 0;
  let started = false;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t === 'M' || t === 'L' || t === 'm' || t === 'l') {
      cmd = t;
      i += 1;
      continue;
    }
    const x = parseFloat(tokens[i]!);
    const y = parseFloat(tokens[i + 1] ?? '');
    if (!Number.isFinite(x) || !Number.isFinite(y)) break;
    i += 2;
    if (cmd === 'M' || cmd === 'm') {
      ctx.moveTo(x, y);
      started = true;
    } else if (started) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      started = true;
    }
  }
  ctx.stroke();
}

/**
 * Rasteriza a rúbrica SVG → PNG sem usar Image() (quebra no Safari/iPhone).
 * Desenha os `<path d="...">` direto no canvas.
 */
export function renderRubricaSvgToPngDataUrl(
  svgUri: string | undefined | null,
  widthPx: number,
  heightPx: number,
): string | null {
  if (typeof document === 'undefined') return null;
  if (!svgUri?.trim()) return null;

  const svg = decodeSvgDataUrl(svgUri);
  if (!svg) return null;

  const { paths, vbW, vbH } = extrairPathsDoSvg(svg);
  if (paths.length === 0) return null;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx * scale));
  canvas.height = Math.max(1, Math.round(heightPx * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sx = canvas.width / vbW;
  const sy = canvas.height / vbH;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = Math.max(2.5, 3.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const d of paths) {
    try {
      if (typeof Path2D !== 'undefined') {
        const p = new Path2D(d);
        ctx.stroke(p);
      } else {
        strokePathManual(ctx, d);
      }
    } catch {
      strokePathManual(ctx, d);
    }
  }
  ctx.restore();

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Traços para desenhar direto no jsPDF (fallback sem PNG). */
export type RubricaStrokePdf = { points: Array<{ x: number; y: number }> };

export function extrairStrokesRubricaParaPdf(
  svgUri: string | undefined | null,
): { strokes: RubricaStrokePdf[]; vbW: number; vbH: number } | null {
  if (!svgUri?.trim()) return null;
  const svg = decodeSvgDataUrl(svgUri);
  if (!svg) return null;
  const { paths, vbW, vbH } = extrairPathsDoSvg(svg);
  if (paths.length === 0) return null;

  const strokes: RubricaStrokePdf[] = [];
  for (const d of paths) {
    const tokens = d.match(/[MLml]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
    if (!tokens) continue;
    const points: Array<{ x: number; y: number }> = [];
    let i = 0;
    let cmd = 'M';
    while (i < tokens.length) {
      const t = tokens[i]!;
      if (t === 'M' || t === 'L' || t === 'm' || t === 'l') {
        cmd = t;
        i += 1;
        continue;
      }
      const x = parseFloat(tokens[i]!);
      const y = parseFloat(tokens[i + 1] ?? '');
      if (!Number.isFinite(x) || !Number.isFinite(y)) break;
      i += 2;
      points.push({ x, y });
      void cmd;
    }
    if (points.length > 0) strokes.push({ points });
  }
  return strokes.length > 0 ? { strokes, vbW, vbH } : null;
}

function desenharRubricaJsPdf(
  doc: import('jspdf').jsPDF,
  svgUri: string | undefined | null,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): boolean {
  const parsed = extrairStrokesRubricaParaPdf(svgUri);
  if (!parsed) return false;

  const { strokes, vbW, vbH } = parsed;
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(1.1);
  doc.setLineCap('round');
  doc.setLineJoin('round');

  for (const stroke of strokes) {
    const pts = stroke.points;
    if (pts.length === 0) continue;
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const x1 = boxX + (a.x / vbW) * boxW;
      const y1 = boxY + (a.y / vbH) * boxH;
      const x2 = boxX + (b.x / vbW) * boxW;
      const y2 = boxY + (b.y / vbH) * boxH;
      doc.line(x1, y1, x2, y2);
    }
    if (pts.length === 1) {
      const p = pts[0]!;
      const x = boxX + (p.x / vbW) * boxW;
      const y = boxY + (p.y / vbH) * boxH;
      doc.line(x, y, x + 0.01, y);
    }
  }
  return true;
}

/**
 * Gera Blob PDF (A4 paisagem) só com jsPDF — inclui desenhos das rúbricas.
 */
export async function gerarResumoAplicacaoPdfBlobWeb(
  resultados: ResultadoCorridaItem[],
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const rubricaPngByIndex = new Map<number, string>();
  const rubricaSvgByIndex = new Map<number, string>();
  for (let index = 0; index < resultados.length; index += 1) {
    const svg = resultados[index]?.rubricaCandidatoSvg?.trim();
    if (!svg) continue;
    rubricaSvgByIndex.set(index, svg);
    const png = renderRubricaSvgToPngDataUrl(svg, RUBRICA_PDF_LARGURA, RUBRICA_PDF_ALTURA);
    if (png) rubricaPngByIndex.set(index, png);
  }

  const aplicadorSvg = aplicadorAssinatura?.rubricaSvg?.trim();
  const aplicadorPng = aplicadorSvg
    ? renderRubricaSvgToPngDataUrl(aplicadorSvg, RUBRICA_PDF_LARGURA * 1.4, RUBRICA_PDF_ALTURA * 1.4)
    : null;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 28;
  const marginTop = 28;
  const temAlgumaRubrica = rubricaSvgByIndex.size > 0 || Boolean(aplicadorSvg);
  const marginBottom = aplicadorAssinatura ? (aplicadorSvg ? 78 : 48) : 36;
  const usableW = pageW - marginX * 2;

  const tituloProvaLabel = tituloProva(resultados);
  const colProva = cabecalhoColuna(resultados);
  const geradoEm = new Date().toLocaleString('pt-BR');

  const imgW = RUBRICA_PDF_LARGURA * 0.85;
  const imgH = RUBRICA_PDF_ALTURA * 0.85;
  // Altura da linha = espaço para texto + rúbrica alinhados na mesma faixa
  const rowH = temAlgumaRubrica ? Math.max(36, imgH + 14) : 18;
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
      w: usableW * 0.12,
      kind: 'text',
      get: (r) => r.reprovacaoTexto || (r.notaTexto === 'REPROVADO' ? 'Reprovado' : 'Aprovado'),
    },
    { title: 'Rubrica', w: usableW * 0.2, kind: 'rubrica' },
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
    y += 10;

    // yCab = baseline do cabeçalho da tabela
    const yCab = y + 12;
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX, y, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    let x = marginX + 4;
    for (const col of cols) {
      doc.text(pdfTexto(col.title), x, yCab, { maxWidth: col.w - 6 });
      x += col.w;
    }
    // Retorna o TOPO da primeira linha de dados
    return y + headerH + 6;
  };

  /**
   * yTop = topo da linha (mesma faixa vertical para Corredor + Rúbrica).
   */
  const drawLinha = (r: ResultadoCorridaItem, index: number, yTop: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    let x = marginX + 4;
    // Baseline do texto no meio vertical da linha
    const textBaseline = yTop + rowH * 0.62;

    for (const col of cols) {
      if (col.kind === 'rubrica') {
        const drawW = Math.min(imgW, col.w - 6);
        const drawH = Math.min(imgH, rowH - 6);
        // Centraliza a rúbrica na célula da coluna, alinhada à mesma linha do Corredor
        const ix = x + (col.w - drawW) / 2;
        const iy = yTop + (rowH - drawH) / 2;
        const png = rubricaPngByIndex.get(index);
        const svg = rubricaSvgByIndex.get(index);
        let ok = false;
        if (png) {
          try {
            doc.addImage(png, 'PNG', ix, iy, drawW, drawH);
            ok = true;
          } catch {
            ok = false;
          }
        }
        if (!ok && svg) {
          ok = desenharRubricaJsPdf(doc, svg, ix, iy, drawW, drawH);
        }
        if (!ok) {
          doc.setTextColor(156, 163, 175);
          doc.text('—', x + col.w / 2 - 3, textBaseline);
          doc.setTextColor(17, 24, 39);
        }
      } else {
        const raw = pdfTexto(col.get?.(r) ?? '—');
        doc.text(raw, x, textBaseline, { maxWidth: col.w - 6 });
      }
      x += col.w;
    }

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(marginX, yTop + rowH - 2, pageW - marginX, yTop + rowH - 2);
  };

  /**
   * Rodapé: rúbrica do aplicador ACIMA do nome (igual ao layout HTML do PDF nativo).
   */
  const drawRodapeAplicador = () => {
    if (!aplicadorAssinatura?.nome?.trim()) return;

    const aw = imgW * 1.35;
    const ah = imgH * 1.35;
    const posto = postoGradExibicaoAssinatura(aplicadorAssinatura);
    const linhaNome = `${posto}  ${aplicadorAssinatura.nome}`;
    const linhaNip = `NIP ${aplicadorAssinatura.nip || '—'}`;

    // De baixo para cima: NIP → nome → linha → rúbrica
    const nipBaseline = pageH - 12;
    const nomeBaseline = nipBaseline - 12;
    const lineY = nomeBaseline - 10;
    const rubricaTop = aplicadorSvg ? lineY - ah - 4 : lineY - 8;

    if (aplicadorSvg) {
      const ix = (pageW - aw) / 2;
      let ok = false;
      if (aplicadorPng) {
        try {
          doc.addImage(aplicadorPng, 'PNG', ix, rubricaTop, aw, ah);
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        desenharRubricaJsPdf(doc, aplicadorSvg, ix, rubricaTop, aw, ah);
      }
    }

    doc.setDrawColor(55, 65, 81);
    doc.setLineWidth(0.7);
    doc.line(pageW / 2 - 130, lineY, pageW / 2 + 130, lineY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(pdfTexto(linhaNome), pageW / 2, nomeBaseline, {
      align: 'center',
      maxWidth: usableW,
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(pdfTexto(linhaNip), pageW / 2, nipBaseline, {
      align: 'center',
      maxWidth: usableW,
    });
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
