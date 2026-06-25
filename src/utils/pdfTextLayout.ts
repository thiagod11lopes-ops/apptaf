export type PdfTextItem = { str: string; x: number; y: number; page?: number };

type PdfItemBruto = { str?: string; transform?: number[] };

export function normalizarItensPdf(items: PdfItemBruto[], page?: number): PdfTextItem[] {
  const posicionados: PdfTextItem[] = [];

  for (const item of items) {
    const str = String(item.str ?? '').trim();
    if (!str) continue;
    const t = item.transform;
    const x = t && t.length >= 6 ? t[4] : 0;
    const y = t && t.length >= 6 ? t[5] : 0;
    posicionados.push(page != null ? { str, x, y, page } : { str, x, y });
  }

  return posicionados;
}

function agruparItensPdfEmLinhasPagina(
  items: PdfTextItem[],
  yTolerance = 3,
): PdfTextItem[][] {
  const linhasPorY = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    const yKey = Math.round(item.y / yTolerance) * yTolerance;
    const grupo = linhasPorY.get(yKey) ?? [];
    grupo.push(item);
    linhasPorY.set(yKey, grupo);
  }

  return [...linhasPorY.keys()]
    .sort((a, b) => b - a)
    .map((yKey) => {
      const grupo = linhasPorY.get(yKey) ?? [];
      grupo.sort((a, b) => a.x - b.x);
      return grupo;
    })
    .filter((grupo) => grupo.length > 0);
}

/** Agrupa itens do PDF em linhas (mesma página e altura Y). */
export function agruparItensPdfEmLinhas(
  items: PdfTextItem[],
  yTolerance = 3,
): PdfTextItem[][] {
  if (items.length === 0) return [];

  const temPagina = items.some((item) => item.page != null);
  if (!temPagina) return agruparItensPdfEmLinhasPagina(items, yTolerance);

  const porPagina = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    const pagina = item.page ?? 0;
    const grupo = porPagina.get(pagina) ?? [];
    grupo.push(item);
    porPagina.set(pagina, grupo);
  }

  const linhas: PdfTextItem[][] = [];
  for (const pagina of [...porPagina.keys()].sort((a, b) => a - b)) {
    linhas.push(...agruparItensPdfEmLinhasPagina(porPagina.get(pagina) ?? [], yTolerance));
  }
  return linhas;
}

/** Reconstrói linhas legíveis a partir dos itens do getTextContent (posição X/Y). */
export function reconstruirTextoDeItensPdf(items: PdfItemBruto[]): string {
  const posicionados = normalizarItensPdf(items);
  if (posicionados.length === 0) return '';

  return agruparItensPdfEmLinhas(posicionados)
    .map((grupo) => grupo.map((g) => g.str).join(' '))
    .filter((l) => l.trim().length > 0)
    .join('\n');
}
