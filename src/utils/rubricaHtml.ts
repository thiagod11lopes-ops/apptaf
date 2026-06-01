/** HTML da miniatura de rúbrica para PDF / impressão. */
export function celulaRubricaHtml(svgUri?: string | null, textoFallback?: string): string {
  const svg = svgUri?.trim() ?? '';
  if (svg.startsWith('data:image/svg')) {
    return `<div class="rubrica-cell"><img src="${svg}" alt="Rúbrica" class="rubrica-img"/></div>`;
  }
  const texto = textoFallback?.trim();
  if (texto) return `<span class="rubrica-texto">${escapeHtmlAttr(texto)}</span>`;
  return '<span class="rubrica-vazio">—</span>';
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const RUBRICA_PDF_STYLES = `
  .nota-com-rubrica { vertical-align: top; }
  .nota-rubrica-linha { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .nota-valor { font-weight: 700; min-width: 2.5em; }
  .rubrica-cell { display: inline-block; }
  .rubrica-img { width: 100px; height: 36px; object-fit: contain; display: block; }
  .rubrica-vazio { color: #94a3b8; font-size: 10px; }
  .rubrica-texto { font-size: 10px; color: #64748b; }
`;
