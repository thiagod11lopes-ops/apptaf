/** Cores padrão da rúbrica exportada (fundo claro, assinatura escura). */
export const RUBRICA_COR_FUNDO = '#FFFFFF';
export const RUBRICA_COR_TRACO = '#111827';

/**
 * Garante fundo branco e traço escuro em SVGs já salvos no modo escuro
 * (fundo escuro + traço branco).
 */
export function normalizarRubricaSvgDataUrl(svgUri?: string | null): string | undefined {
  const raw = svgUri?.trim();
  if (!raw) return undefined;
  if (!raw.startsWith('data:image/svg')) return raw;

  const match = raw.match(/^data:image\/svg\+xml(;utf8)?,/i);
  const prefix = match?.[0] ?? 'data:image/svg+xml;utf8,';
  const encoded = raw.slice(prefix.length);

  let svg: string;
  try {
    svg = decodeURIComponent(encoded);
  } catch {
    return raw;
  }

  svg = svg.replace(
    /<rect([^>]*)\/>/i,
    (_full, attrs: string) => {
      const cleaned = attrs
        .replace(/\s*fill="[^"]*"/gi, '')
        .replace(/\s*width="[^"]*"/gi, '')
        .replace(/\s*height="[^"]*"/gi, '');
      return `<rect width="100%" height="100%" fill="${RUBRICA_COR_FUNDO}"${cleaned}/>`;
    },
  );

  svg = svg.replace(/stroke="#FFFFFF"/gi, `stroke="${RUBRICA_COR_TRACO}"`);
  svg = svg.replace(/stroke="#fff"/gi, `stroke="${RUBRICA_COR_TRACO}"`);
  svg = svg.replace(/stroke="white"/gi, `stroke="${RUBRICA_COR_TRACO}"`);
  svg = svg.replace(/stroke='white'/gi, `stroke="${RUBRICA_COR_TRACO}"`);

  return `${prefix}${encodeURIComponent(svg)}`;
}
