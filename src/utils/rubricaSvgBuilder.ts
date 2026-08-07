import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from './rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA, RUBRICA_NATIVA_LARGURA } from './rubricaConstants';

export type RubricaPoint = { x: number; y: number };
export type RubricaStroke = RubricaPoint[];

/** Texto diagonal gravado com “No Impedimento” no registrador manual. */
export const RUBRICA_TEXTO_NO_IMPEDIMENTO = 'Rubrica do Aplicador';
export const RUBRICA_NO_IMPEDIMENTO_ATTR = 'data-taf-no-impedimento';

export function buildStrokePath(points: RubricaPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** SVG `<text>` em diagonal (transversal) sobre a área da rúbrica. */
export function buildTextoTransversalSvg(
  width: number,
  height: number,
  texto: string = RUBRICA_TEXTO_NO_IMPEDIMENTO,
): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const cx = (w / 2).toFixed(1);
  const cy = (h / 2).toFixed(1);
  const fontSize = Math.max(13, Math.round(Math.min(w, h) * 0.13));
  const safe = escapeXml(texto);
  return (
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" ` +
    `fill="rgba(17,24,39,0.42)" font-family="Arial,Helvetica,sans-serif" ` +
    `font-size="${fontSize}" font-weight="700" letter-spacing="0.5" ` +
    `transform="rotate(-28 ${cx} ${cy})">${safe}</text>`
  );
}

export function buildRubricaSvgDataUrl(
  strokes: RubricaStroke[],
  width = RUBRICA_NATIVA_LARGURA,
  height = RUBRICA_NATIVA_ALTURA,
  strokeColor = RUBRICA_COR_TRACO,
  bgColor = RUBRICA_COR_FUNDO,
  options?: { textoTransversal?: string | null },
): string {
  const paths = strokes
    .filter((s) => s.length > 0)
    .map(
      (s) =>
        `<path d="${buildStrokePath(s)}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const texto = options?.textoTransversal?.trim();
  const overlay = texto ? buildTextoTransversalSvg(safeWidth, safeHeight, texto) : '';
  const noImpAttr = texto ? ` ${RUBRICA_NO_IMPEDIMENTO_ATTR}="1"` : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" ` +
    `viewBox="0 0 ${safeWidth} ${safeHeight}"${noImpAttr}>` +
    `<rect width="100%" height="100%" fill="${bgColor}"/>${paths}${overlay}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function svgTemNoImpedimento(svgMarkupOrDataUrl: string): boolean {
  const raw = svgMarkupOrDataUrl.trim();
  if (!raw) return false;
  if (raw.includes(`${RUBRICA_NO_IMPEDIMENTO_ATTR}=`)) return true;
  return raw.includes(RUBRICA_TEXTO_NO_IMPEDIMENTO);
}
