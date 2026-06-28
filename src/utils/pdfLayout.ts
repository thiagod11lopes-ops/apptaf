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
export const PDF_LANDSCAPE_PAGE_STYLES = `
  @page {
    size: A4 landscape;
    margin: 10mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
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
    padding: 8px 14px 10px;
    border-bottom: 1px solid #d1d5db;
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
  }
  .pdf-print-footer .aplicador-assinatura {
    margin-top: 0;
    page-break-inside: avoid;
  }
  .pdf-print-body {
    padding: 76px 14px 118px;
  }
  .pdf-print-body--sem-aplicador {
    padding-bottom: 18px;
  }
  @media print {
    .pdf-print-header,
    .pdf-print-footer {
      position: fixed;
    }
  }
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
  const bodyClass = hasAplicador ? 'pdf-print-body' : 'pdf-print-body pdf-print-body--sem-aplicador';
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
  <div class="${bodyClass}">
    ${options.conteudoHtml}
  </div>
</body>
</html>`;
}
