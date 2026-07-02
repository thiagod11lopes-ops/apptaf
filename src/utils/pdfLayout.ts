/** A4 paisagem em pontos (72 PPI) — expo-print e referência de layout. */
export const PDF_A4_LANDSCAPE_WIDTH = 842;
export const PDF_A4_LANDSCAPE_HEIGHT = 595;

/** Margens @page (mm) — laterais e rodapé; o topo usa espaçador por bloco de folha. */
export const PDF_PAGE_MARGIN_TOP_MM = 8;
export const PDF_PAGE_MARGIN_BOTTOM_MM = 22;
export const PDF_PAGE_MARGIN_BOTTOM_SEM_ASSINATURA_MM = 10;
export const PDF_PAGE_MARGIN_SIDE_MM = 10;

/** Espaço acima da tabela em cada folha — evita sobreposição com o título fixo. */
export const PDF_PRINT_TOP_GAP_MM = 26;

/** Máximo de linhas de dados por folha — visual limpo e previsível. */
export const PDF_MAX_ROWS_PER_PAGE = 12;

export function escapeHtmlPdf(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Estilos de tabela — blocos paginados mantêm thead junto às linhas da folha. */
export const PDF_PRINT_TABLE_STYLES = `
  .pdf-print-body table {
    width: 100%;
    border-collapse: collapse;
  }
  .pdf-print-page-block table {
    page-break-inside: avoid;
    break-inside: avoid-page;
    width: 100%;
    border-collapse: collapse;
  }
  .pdf-print-body table thead,
  .pdf-print-page-block table thead {
    display: table-header-group;
  }
  .pdf-print-body table tbody,
  .pdf-print-page-block table tbody {
    display: table-row-group;
  }
  .pdf-print-body table thead tr,
  .pdf-print-page-block table thead tr {
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-body table tbody tr,
  .pdf-print-page-block table tbody tr {
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-page-block table thead th {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-print-leading {
    page-break-inside: avoid;
    break-inside: avoid-page;
    margin-bottom: 8px;
  }
  .pdf-print-page-block {
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-page-block + .pdf-print-page-block {
    page-break-before: always;
    break-before: page;
    margin-top: 0;
  }
  .pdf-print-top-gap {
    display: block;
    width: 100%;
    height: ${PDF_PRINT_TOP_GAP_MM}mm;
    min-height: ${PDF_PRINT_TOP_GAP_MM}mm;
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  @media print {
    .pdf-print-body table thead {
      display: table-header-group;
    }
  }
`;

export type BuildPdfTableOptions = {
  tableClass: string;
  theadHtml: string;
  rowHtml: string[];
  emptyColspan: number;
  emptyMessage?: string;
  leadingHtml?: string;
  rowsPerPage?: number;
};

/** Divide linhas `<tr>…</tr>` em blocos de até N linhas por folha. */
export function paginatePdfTableRows(rows: string[], rowsPerPage: number): string[][] {
  if (rows.length === 0) return [];
  const limit = Math.max(1, rowsPerPage);
  const chunks: string[][] = [];
  for (let index = 0; index < rows.length; index += limit) {
    chunks.push(rows.slice(index, index + limit));
  }
  return chunks;
}

function renderPdfTableChunk(
  tableClass: string,
  theadHtml: string,
  rows: string[],
  emptyColspan: number,
  emptyMessage: string,
): string {
  const tbody =
    rows.length > 0
      ? rows.join('')
      : `<tr><td colspan="${emptyColspan}">${emptyMessage}</td></tr>`;
  return `<table class="${tableClass}">
    <thead>${theadHtml}</thead>
    <tbody>${tbody}</tbody>
  </table>`;
}

function pdfPageBlockOpen(): string {
  return `<section class="pdf-print-page-block"><div class="pdf-print-top-gap" aria-hidden="true"></div>`;
}

/** Tabela paginada — até 12 linhas por folha, com cabeçalho de colunas repetido. */
export function buildPaginatedPdfTableHtml(options: BuildPdfTableOptions): string {
  const {
    tableClass,
    theadHtml,
    rowHtml,
    emptyColspan,
    emptyMessage = 'Nenhum registro',
    leadingHtml = '',
    rowsPerPage = PDF_MAX_ROWS_PER_PAGE,
  } = options;

  if (rowHtml.length === 0) {
    const leading = leadingHtml ? `<div class="pdf-print-leading">${leadingHtml}</div>` : '';
    return `${pdfPageBlockOpen()}${leading}${renderPdfTableChunk(
      tableClass,
      theadHtml,
      [],
      emptyColspan,
      emptyMessage,
    )}</section>`;
  }

  const chunks = paginatePdfTableRows(rowHtml, rowsPerPage);
  return chunks
    .map((chunk, pageIndex) => {
      const leading =
        pageIndex === 0 && leadingHtml ? `<div class="pdf-print-leading">${leadingHtml}</div>` : '';
      return `${pdfPageBlockOpen()}${leading}${renderPdfTableChunk(
        tableClass,
        theadHtml,
        chunk,
        emptyColspan,
        emptyMessage,
      )}</section>`;
    })
    .join('\n');
}

/** Atalho — aplica paginação padrão de 12 linhas por folha. */
export function buildPdfTableHtml(options: BuildPdfTableOptions): string {
  return buildPaginatedPdfTableHtml(options);
}

/** Altura útil da área de conteúdo (pt) para estimativa de folhas. */
export function pdfLandscapeContentHeightPt(hasAplicadorFooter: boolean): number {
  const mmToPt = 72 / 25.4;
  const top = (PDF_PAGE_MARGIN_TOP_MM + PDF_PRINT_TOP_GAP_MM) * mmToPt;
  const bottom =
    (hasAplicadorFooter ? PDF_PAGE_MARGIN_BOTTOM_MM : PDF_PAGE_MARGIN_BOTTOM_SEM_ASSINATURA_MM) *
    mmToPt;
  return PDF_A4_LANDSCAPE_HEIGHT - top - bottom;
}

export function estimarFolhasPdfPorLinhas(
  quantidadeLinhas: number,
  rowsPerPage = PDF_MAX_ROWS_PER_PAGE,
): number {
  if (quantidadeLinhas <= 0) return 0;
  return Math.ceil(quantidadeLinhas / Math.max(1, rowsPerPage));
}

function pdfPageStyles(hasAplicador: boolean): string {
  const bottom = hasAplicador
    ? PDF_PAGE_MARGIN_BOTTOM_MM
    : PDF_PAGE_MARGIN_BOTTOM_SEM_ASSINATURA_MM;
  return `
  @page {
    size: A4 landscape;
    margin: ${PDF_PAGE_MARGIN_TOP_MM}mm ${PDF_PAGE_MARGIN_SIDE_MM}mm ${bottom}mm ${PDF_PAGE_MARGIN_SIDE_MM}mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #111827;
    line-height: 1.15;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-print-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    box-sizing: border-box;
    padding: 2mm ${PDF_PAGE_MARGIN_SIDE_MM}mm 3mm;
    background: #fff;
    border-bottom: 1px solid #d1d5db;
  }
  .pdf-print-header h1 {
    font-size: 16px;
    margin: 0 0 2px;
    line-height: 1.2;
    font-weight: 800;
  }
  .pdf-print-header .meta {
    font-size: 11px;
    color: #6b7280;
    margin: 0;
    line-height: 1.25;
  }
  .pdf-print-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    box-sizing: border-box;
    padding: 2mm ${PDF_PAGE_MARGIN_SIDE_MM}mm 2mm;
    background: #fff;
    border-top: 1px solid #d1d5db;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 8px 20px;
  }
  .pdf-print-footer .aplicador-assinatura {
    margin-top: 0;
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-body {
    padding: 0 2px;
    overflow: visible;
    height: auto;
  }
  @media print {
    html, body {
      overflow: visible !important;
      height: auto !important;
    }
    .pdf-print-body {
      overflow: visible !important;
      height: auto !important;
    }
    .pdf-print-header,
    .pdf-print-footer {
      position: fixed;
    }
  }
  ${PDF_PRINT_TABLE_STYLES}
`;
}

export type PdfLandscapeDocumentOptions = {
  documentTitle: string;
  titulo: string;
  /** HTML seguro (partes dinâmicas já escapadas). */
  metaHtml: string;
  conteudoHtml: string;
  aplicadorHtml?: string;
  extraStyles?: string;
};

/** Documento A4 paisagem: título e assinatura fixos por folha; tabela preenche o espaço restante. */
export function buildPdfLandscapeDocument(options: PdfLandscapeDocumentOptions): string {
  const hasAplicador = Boolean(options.aplicadorHtml?.trim());
  const footer = hasAplicador ? `<div class="pdf-print-footer">${options.aplicadorHtml}</div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtmlPdf(options.documentTitle)}</title>
  <style>
    ${pdfPageStyles(hasAplicador)}
    ${options.extraStyles ?? ''}
  </style>
</head>
<body>
  <div class="pdf-print-header">
    <h1>${escapeHtmlPdf(options.titulo)}</h1>
    <p class="meta">${options.metaHtml}</p>
  </div>
  ${footer}
  <div class="pdf-print-body">
    ${options.conteudoHtml}
  </div>
</body>
</html>`;
}

export const PDF_LANDSCAPE_PAGE_STYLES = pdfPageStyles(true);
