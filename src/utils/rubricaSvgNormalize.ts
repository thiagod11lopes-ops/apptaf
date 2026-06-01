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

/** Traços um pouco mais grossos para leitura da rúbrica reduzida no PDF. */
export function rubricaSvgParaPdf(svgUri?: string | null): string | undefined {
  const base = normalizarRubricaSvgDataUrl(svgUri);
  if (!base?.startsWith('data:image/svg')) return base;

  const match = base.match(/^data:image\/svg\+xml(;utf8)?,/i);
  const prefix = match?.[0] ?? 'data:image/svg+xml;utf8,';
  const encoded = base.slice(prefix.length);

  let svg: string;
  try {
    svg = decodeURIComponent(encoded);
  } catch {
    return base;
  }

  svg = svg.replace(/stroke-width="2\.5"/gi, 'stroke-width="3.25"');
  svg = svg.replace(/stroke-width='2\.5'/gi, "stroke-width='3.25'");

  return `${prefix}${encodeURIComponent(svg)}`;
}
