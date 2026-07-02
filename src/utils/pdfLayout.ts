/** A4 paisagem em pontos (72 PPI) — expo-print e referência de layout. */
export const PDF_A4_LANDSCAPE_WIDTH = 842;
export const PDF_A4_LANDSCAPE_HEIGHT = 595;

/** Margens @page (mm) — reservam área para cabeçalho/rodapé fixos sem sobrepor a tabela. */
export const PDF_PAGE_MARGIN_TOP_MM = 14;
export const PDF_PAGE_MARGIN_BOTTOM_MM = 22;
export const PDF_PAGE_MARGIN_BOTTOM_SEM_ASSINATURA_MM = 10;
export const PDF_PAGE_MARGIN_SIDE_MM = 10;

export function escapeHtmlPdf(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Estilos de tabela — quebra de linha automática pelo navegador; thead repete em cada folha. */
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
  }
  .pdf-print-body table thead tr {
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-body table tbody tr {
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .pdf-print-leading {
    page-break-inside: avoid;
    break-inside: avoid-page;
    margin-bottom: 8px;
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
};

/** Tabela única — o navegador preenche cada folha e quebra linhas quando necessário. */
export function buildPdfTableHtml(options: BuildPdfTableOptions): string {
  const {
    tableClass,
    theadHtml,
    rowHtml,
    emptyColspan,
    emptyMessage = 'Nenhum registro',
    leadingHtml = '',
  } = options;

  const tbody =
    rowHtml.length > 0
      ? rowHtml.join('')
      : `<tr><td colspan="${emptyColspan}">${emptyMessage}</td></tr>`;

  const leading = leadingHtml ? `<div class="pdf-print-leading">${leadingHtml}</div>` : '';

  return `${leading}<table class="${tableClass}">
    <thead>${theadHtml}</thead>
    <tbody>${tbody}</tbody>
  </table>`;
}

/** Altura útil da área de conteúdo (pt) para estimativa de folhas. */
export function pdfLandscapeContentHeightPt(hasAplicadorFooter: boolean): number {
  const mmToPt = 72 / 25.4;
  const top = PDF_PAGE_MARGIN_TOP_MM * mmToPt;
  const bottom =
    (hasAplicadorFooter ? PDF_PAGE_MARGIN_BOTTOM_MM : PDF_PAGE_MARGIN_BOTTOM_SEM_ASSINATURA_MM) *
    mmToPt;
  return PDF_A4_LANDSCAPE_HEIGHT - top - bottom;
}

export function estimarFolhasPdfPorLinhas(
  quantidadeLinhas: number,
  alturaLinhaPt: number,
  overheadPrimeiraPaginaPt = 0,
  hasAplicadorFooter = false,
): number {
  if (quantidadeLinhas <= 0) return 0;
  const util = pdfLandscapeContentHeightPt(hasAplicadorFooter);
  const theadPt = 22;
  const primeira = Math.max(
    1,
    Math.floor((util - overheadPrimeiraPaginaPt - theadPt) / alturaLinhaPt),
  );
  const demais = Math.max(1, Math.floor((util - theadPt) / alturaLinhaPt));
  if (quantidadeLinhas <= primeira) return 1;
  return 1 + Math.ceil((quantidadeLinhas - primeira) / demais);
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
    padding: 2mm ${PDF_PAGE_MARGIN_SIDE_MM}mm 2mm;
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

/** @deprecated Use buildPdfTableHtml — paginação manual removida em favor de quebra automática. */
export function buildPaginatedPdfTableHtml(options: BuildPdfTableOptions): string {
  return buildPdfTableHtml(options);
}

/** @deprecated Mantido para testes legados. */
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

export const PDF_LANDSCAPE_PAGE_STYLES = pdfPageStyles(true);
