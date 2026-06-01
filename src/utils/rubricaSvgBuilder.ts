import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from './rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA, RUBRICA_NATIVA_LARGURA } from './rubricaConstants';

export type RubricaPoint = { x: number; y: number };
export type RubricaStroke = RubricaPoint[];

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

export function buildRubricaSvgDataUrl(
  strokes: RubricaStroke[],
  width = RUBRICA_NATIVA_LARGURA,
  height = RUBRICA_NATIVA_ALTURA,
  strokeColor = RUBRICA_COR_TRACO,
  bgColor = RUBRICA_COR_FUNDO,
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><rect width="100%" height="100%" fill="${bgColor}"/>${paths}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
