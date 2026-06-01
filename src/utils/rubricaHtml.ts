import { RUBRICA_NATIVA_ALTURA, RUBRICA_NATIVA_LARGURA } from './rubricaConstants';
import { normalizarRubricaSvgDataUrl } from './rubricaSvgNormalize';

/** HTML da coluna Rúbrica para PDF — sem fundo, imagem em resolução nativa. */
export function celulaRubricaHtml(svgUri?: string | null): string {
  const svg = normalizarRubricaSvgDataUrl(svgUri) ?? '';
  if (svg.startsWith('data:image/svg')) {
    return `<img src="${svg}" alt="Rúbrica" class="rubrica-img" width="${RUBRICA_NATIVA_LARGURA}" height="${RUBRICA_NATIVA_ALTURA}"/>`;
  }
  return '<span class="rubrica-vazio">—</span>';
}

export const RUBRICA_PDF_STYLES = `
  td.col-rubrica {
    background: transparent !important;
    padding: 4px 6px;
    text-align: center;
    vertical-align: middle;
    width: ${RUBRICA_NATIVA_LARGURA + 24}px;
  }
  .rubrica-img {
    width: ${RUBRICA_NATIVA_LARGURA}px;
    height: ${RUBRICA_NATIVA_ALTURA}px;
    max-width: 100%;
    object-fit: contain;
    display: block;
    margin: 0 auto;
    background: none;
    border: none;
  }
  .rubrica-vazio {
    color: #94a3b8;
    font-size: 10px;
  }
`;
