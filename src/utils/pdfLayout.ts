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

/** Cabeçalho/rodapé fixos repetidos em cada página na impressão/PDF. */
export const PDF_PRINT_TABLE_STYLES = `
  .pdf-print-body table {
    width: 100%;
    border-collapse: collapse;
    page-break-inside: auto;
    break-inside: auto;
  }
  .pdf-print-body table.pdf-table-continuacao {
    page-break-before: always;
    break-before: page;
    margin-top: 0;
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
  @media print {
    .pdf-print-body table thead {
      display: table-header-group;
    }
    .pdf-print-body table thead tr {
      break-inside: avoid;
      page-break-inside: avoid;
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

/** Monta uma ou mais tabelas, repetindo o cabeçalho de colunas em cada folha. */
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
  } = options;

  if (rowHtml.length === 0) {
    return `${leadingHtml}<table class="${tableClass}"><thead>${theadHtml}</thead><tbody><tr><td colspan="${emptyColspan}">${emptyMessage}</td></tr></tbody></table>`;
  }

  const chunks = paginatePdfTableRows(rowHtml, rowsFirstPage, rowsOtherPage);
  return chunks
    .map((chunk, pageIndex) => {
      const continuation = pageIndex > 0 ? ' pdf-table-continuacao' : '';
      const prefix = pageIndex === 0 ? leadingHtml : '';
      return `${prefix}<table class="${tableClass}${continuation}">
    <thead>${theadHtml}</thead>
    <tbody>${chunk.join('')}</tbody>
  </table>`;
    })
    .join('\n');
}

export const PDF_LANDSCAPE_PAGE_STYLES = `
  @page {
    size: A4 landscape;
    margin: 22mm 10mm 30mm 10mm;
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
  .pdf-print-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: #fff;
    padding: 6px 14px 8px;
    border-bottom: 1px solid #d1d5db;
    box-sizing: border-box;
  }
  .pdf-print-header h1 {
    font-size: 22px;
    margin: 0 0 4px;
    line-height: 1.15;
    font-weight: 800;
  }
  .pdf-print-header .meta {
    font-size: 15px;
    color: #6b7280;
    margin: 0;
    line-height: 1.15;
  }
  .pdf-print-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: #fff;
    padding: 4px 14px 6px;
    border-top: 1px solid #d1d5db;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 12px 24px;
    box-sizing: border-box;
  }
  .pdf-print-footer .aplicador-assinatura {
    margin-top: 0;
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-body {
    padding: 0 14px;
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

export type PdfLandscapeDocumentOptions = {
  documentTitle: string;
  titulo: string;
  /** HTML seguro (partes dinâmicas já escapadas). */
  metaHtml: string;
  conteudoHtml: string;
  aplicadorHtml?: string;
  extraStyles?: string;
};

/** Documento HTML em A4 paisagem com título/meta e assinatura do aplicador em todas as páginas. */
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
    ${PDF_LANDSCAPE_PAGE_STYLES}
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
