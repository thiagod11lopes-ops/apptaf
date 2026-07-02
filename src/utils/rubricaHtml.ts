import {
  RUBRICA_PDF_ALTURA,
  RUBRICA_PDF_LARGURA,
} from './rubricaConstants';
import { rubricaSvgParaPdf } from './rubricaSvgNormalize';

/** Tipografia da tabela nos PDFs (+50% fonte, −15% altura de linha vs. compacto anterior). */
const PDF_TABELA_FONT_PX = 14;
const PDF_TABELA_TH_FONT_PX = 12;
const PDF_TABELA_LINE_HEIGHT = 0.98;
const PDF_TABELA_PAD_V = 2;
const PDF_TABELA_PAD_H = 4;
const PDF_TABELA_TH_PAD_V = 3;
const PDF_COL_RUBRICA_LINE_HEIGHT = 0.94;
const PDF_COL_RUBRICA_MAX_EXTRA = 4;

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
    padding: ${Math.round(2 * 0.85)}px ${Math.round(3 * 0.85)}px !important;
    text-align: center;
    vertical-align: middle;
    width: ${RUBRICA_PDF_LARGURA + 14}px;
    max-height: ${Math.round((RUBRICA_PDF_ALTURA + PDF_COL_RUBRICA_MAX_EXTRA) * 0.85)}px;
    line-height: ${PDF_COL_RUBRICA_LINE_HEIGHT};
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
    font-size: ${PDF_TABELA_FONT_PX}px;
    line-height: ${PDF_COL_RUBRICA_LINE_HEIGHT};
  }
`;

/** Estilos de tabela para PDFs com rúbrica. */
export const PDF_TABELA_COMPACTA_STYLES = `
  table.resultados-taf { width: 100%; border-collapse: collapse; font-size: ${PDF_TABELA_FONT_PX}px; }
  table.resultados-taf th,
  table.resultados-taf td {
    border: 1px solid #ccc;
    padding: ${PDF_TABELA_PAD_V}px ${PDF_TABELA_PAD_H}px;
    text-align: left;
    vertical-align: middle;
    line-height: ${PDF_TABELA_LINE_HEIGHT};
  }
  table.resultados-taf th {
    background: #e8eef5;
    font-weight: 700;
    padding: ${PDF_TABELA_TH_PAD_V}px ${PDF_TABELA_PAD_H}px;
    font-size: ${PDF_TABELA_TH_FONT_PX}px;
    line-height: ${PDF_TABELA_LINE_HEIGHT};
  }
  table.resultados-taf th.col-rubrica,
  table.resultados-taf td.col-rubrica {
    text-align: center;
  }
  table.resultados-taf th.col-nome,
  table.resultados-taf td.col-nome {
    white-space: nowrap;
  }
  table.resultados-taf thead {
    display: table-header-group;
  }
  table.resultados-taf .nota {
    font-weight: 700;
    text-align: center;
  }
`;
