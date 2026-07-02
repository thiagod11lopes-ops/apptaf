/** A4 paisagem em pontos (72 PPI) — expo-print e referência de layout. */
export const PDF_A4_LANDSCAPE_WIDTH = 842;
export const PDF_A4_LANDSCAPE_HEIGHT = 595;

export function escapeHtmlPdf(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Estilos de tabela e seções de página (sem cabeçalho/rodapé fixos). */
export const PDF_PRINT_TABLE_STYLES = `
  .pdf-print-body table {
    width: 100%;
    border-collapse: collapse;
    page-break-inside: auto;
    break-inside: auto;
  }
  .pdf-print-body table thead {
    display: table-header-group;
  }
  .pdf-print-body table tbody {
    display: table-row-group;
    page-break-inside: auto;
    break-inside: auto;
  }
  .pdf-print-body table tfoot {
    display: table-footer-group;
  }
  .pdf-print-body table thead tr {
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-body table tbody tr {
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-page {
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
    padding: 0 2px 4px;
  }
  .pdf-print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .pdf-print-page-doc-header {
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #d1d5db;
  }
  .pdf-print-page-doc-header h1 {
    font-size: 17px;
    margin: 0 0 3px;
    line-height: 1.2;
    font-weight: 800;
  }
  .pdf-print-page-doc-header .meta {
    font-size: 11px;
    color: #6b7280;
    margin: 0;
    line-height: 1.25;
  }
  .pdf-print-page-content {
    margin: 0;
  }
  .pdf-print-page-doc-footer {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #d1d5db;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 8px 20px;
  }
  .pdf-print-page-doc-footer .aplicador-assinatura {
    margin-top: 0;
  }
  @media print {
    .pdf-print-body table thead {
      display: table-header-group;
    }
    .pdf-print-page {
      page-break-after: always;
      break-after: page;
    }
    .pdf-print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }
`;

export type BuildPaginatedPdfTableOptions = {
  tableClass: string;
  theadHtml: string;
  rowHtml: string[];
  rowsFirstPage: number;
  rowsOtherPage: number;
  emptyColspan: number;
  emptyMessage?: string;
  leadingHtml?: string;
  /** Título e meta repetidos no topo de cada folha (fluxo normal, sem sobreposição). */
  pageDocHeaderHtml?: string;
  /** Assinatura(s) do aplicador no rodapé de cada folha. */
  pageDocFooterHtml?: string;
};

/** Divide linhas `<tr>…</tr>` em blocos que cabem em cada folha A4 paisagem. */
export function paginatePdfTableRows(
  rows: string[],
  rowsFirstPage: number,
  rowsOtherPage: number,
): string[][] {
  if (rows.length === 0) return [];
  if (rows.length <= rowsFirstPage) return [rows];
  const chunks: string[][] = [rows.slice(0, rowsFirstPage)];
  let index = rowsFirstPage;
  while (index < rows.length) {
    chunks.push(rows.slice(index, index + rowsOtherPage));
    index += rowsOtherPage;
  }
  return chunks;
}

function wrapPdfPageSection(
  innerHtml: string,
  pageDocHeaderHtml?: string,
  pageDocFooterHtml?: string,
): string {
  const header = pageDocHeaderHtml
    ? `<div class="pdf-print-page-doc-header">${pageDocHeaderHtml}</div>`
    : '';
  const footer = pageDocFooterHtml?.trim()
    ? `<div class="pdf-print-page-doc-footer">${pageDocFooterHtml}</div>`
    : '';

  if (!header && !footer) return innerHtml;

  return `<section class="pdf-print-page">
    ${header}
    <div class="pdf-print-page-content">${innerHtml}</div>
    ${footer}
  </section>`;
}

/** Monta uma ou mais tabelas em seções de página, repetindo cabeçalho de colunas e doc. */
export function buildPaginatedPdfTableHtml(options: BuildPaginatedPdfTableOptions): string {
  const {
    tableClass,
    theadHtml,
    rowHtml,
    rowsFirstPage,
    rowsOtherPage,
    emptyColspan,
    emptyMessage = 'Nenhum registro',
    leadingHtml = '',
    pageDocHeaderHtml,
    pageDocFooterHtml,
  } = options;

  const tableHtml = (rows: string[]) =>
    `<table class="${tableClass}">
    <thead>${theadHtml}</thead>
    <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${emptyColspan}">${emptyMessage}</td></tr>`}</tbody>
  </table>`;

  if (rowHtml.length === 0) {
    return wrapPdfPageSection(
      `${leadingHtml}${tableHtml([])}`,
      pageDocHeaderHtml,
      pageDocFooterHtml,
    );
  }

  const chunks = paginatePdfTableRows(rowHtml, rowsFirstPage, rowsOtherPage);
  return chunks
    .map((chunk, pageIndex) => {
      const prefix = pageIndex === 0 ? leadingHtml : '';
      return wrapPdfPageSection(
        `${prefix}${tableHtml(chunk)}`,
        pageDocHeaderHtml,
        pageDocFooterHtml,
      );
    })
    .join('\n');
}

export const PDF_LANDSCAPE_PAGE_STYLES = `
  @page {
    size: A4 landscape;
    margin: 10mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #111827;
    line-height: 1.15;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-print-body {
    padding: 0 8px 8px;
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
  }
  ${PDF_PRINT_TABLE_STYLES}
`;

export type PdfLandscapeDocumentOptions = {
  documentTitle: string;
  titulo: string;
  /** HTML seguro (partes dinâmicas já escapadas). */
  metaHtml: string;
  conteudoHtml: string;
  aplicadorHtml?: string;
  extraStyles?: string;
};

/** Documento HTML em A4 paisagem; título e assinatura ficam dentro de cada seção de página. */
export function buildPdfLandscapeDocument(options: PdfLandscapeDocumentOptions): string {
  let conteudoHtml = options.conteudoHtml;
  if (!conteudoHtml.includes('pdf-print-page')) {
    const pageHeaderHtml = `<h1>${escapeHtmlPdf(options.titulo)}</h1><p class="meta">${options.metaHtml}</p>`;
    conteudoHtml = wrapPdfPageSection(conteudoHtml, pageHeaderHtml, options.aplicadorHtml);
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtmlPdf(options.documentTitle)}</title>
  <style>
    ${PDF_LANDSCAPE_PAGE_STYLES}
    ${options.extraStyles ?? ''}
  </style>
</head>
<body>
  <div class="pdf-print-body">
    ${conteudoHtml}
  </div>
</body>
</html>`;
}
