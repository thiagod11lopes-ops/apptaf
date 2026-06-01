/** Reconstrói linhas legíveis a partir dos itens do getTextContent (posição X/Y). */
export function reconstruirTextoDeItensPdf(
  items: Array<{ str?: string; transform?: number[] }>,
): string {
  type ItemPos = { str: string; x: number; y: number };
  const posicionados: ItemPos[] = [];

  for (const item of items) {
    const str = String(item.str ?? '').trim();
    if (!str) continue;
    const t = item.transform;
    const x = t && t.length >= 6 ? t[4] : 0;
    const y = t && t.length >= 6 ? t[5] : 0;
    posicionados.push({ str, x, y });
  }

  if (posicionados.length === 0) return '';

  // Agrupa por linha (mesma altura Y, tolerância de 3pt).
  const linhasPorY = new Map<number, ItemPos[]>();
  for (const item of posicionados) {
    const yKey = Math.round(item.y / 3) * 3;
    const grupo = linhasPorY.get(yKey) ?? [];
    grupo.push(item);
    linhasPorY.set(yKey, grupo);
  }

  const ysOrdenados = [...linhasPorY.keys()].sort((a, b) => b - a);

  return ysOrdenados
    .map((yKey) => {
      const grupo = linhasPorY.get(yKey) ?? [];
      grupo.sort((a, b) => a.x - b.x);
      return grupo.map((g) => g.str).join(' ');
    })
    .filter((l) => l.trim().length > 0)
    .join('\n');
}
