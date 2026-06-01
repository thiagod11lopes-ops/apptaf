import {
  RUBRICA_PDF_ALTURA,
  RUBRICA_PDF_LARGURA,
} from './rubricaConstants';
import { rubricaSvgParaPdf } from './rubricaSvgNormalize';

/** HTML da coluna Rúbrica para PDF — compacto, traço reforçado para boa leitura. */
export function celulaRubricaHtml(svgUri?: string | null): string {
  const svg = rubricaSvgParaPdf(svgUri) ?? '';
  if (svg.startsWith('data:image/svg')) {
    return `<img src="${svg}" alt="Rúbrica" class="rubrica-img" width="${RUBRICA_PDF_LARGURA}" height="${RUBRICA_PDF_ALTURA}"/>`;
  }
  return '<span class="rubrica-vazio">—</span>';
}

export const RUBRICA_PDF_STYLES = `
  td.col-rubrica {
    background: transparent !important;
    padding: 2px 3px !important;
    text-align: center;
    vertical-align: middle;
    width: ${RUBRICA_PDF_LARGURA + 14}px;
    max-height: ${RUBRICA_PDF_ALTURA + 5}px;
    line-height: 1.1;
  }
  .rubrica-img {
    width: ${RUBRICA_PDF_LARGURA}px;
    height: ${RUBRICA_PDF_ALTURA}px;
    max-width: 100%;
    max-height: ${RUBRICA_PDF_ALTURA}px;
    object-fit: contain;
    object-position: center;
    display: block;
    margin: 0 auto;
    background: none;
    border: none;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
  .rubrica-vazio {
    color: #94a3b8;
    font-size: 9px;
    line-height: 1;
  }
`;

/** Estilos de tabela compacta para PDFs com rúbrica (altura de linha ~metade). */
export const PDF_TABELA_COMPACTA_STYLES = `
  table.resultados-taf { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.resultados-taf th,
  table.resultados-taf td {
    border: 1px solid #ccc;
    padding: 2px 4px;
    text-align: left;
    vertical-align: middle;
    line-height: 1.15;
  }
  table.resultados-taf th {
    background: #e8eef5;
    font-weight: 700;
    padding: 3px 4px;
    font-size: 8px;
  }
  table.resultados-taf th.col-rubrica,
  table.resultados-taf td.col-rubrica {
    text-align: center;
  }
  table.resultados-taf .nota {
    font-weight: 700;
    text-align: center;
  }
`;
