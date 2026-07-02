import { describe, expect, it } from 'vitest';
import { buildPdfLandscapeDocument, buildPaginatedPdfTableHtml } from '../../src/utils/pdfLayout';

describe('pdfLayout', () => {
  it('gera documento A4 paisagem com seções de página no fluxo normal', () => {
    const html = buildPdfLandscapeDocument({
      documentTitle: 'Teste',
      titulo: 'Resumo da aplicação — TAF',
      metaHtml: 'Gerado em 28/06/2026 · <strong>Corrida</strong>',
      conteudoHtml: '<table><tr><td>Linha</td></tr></table>',
      aplicadorHtml: '<div class="aplicador-assinatura">Assinatura</div>',
    });
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('pdf-print-page');
    expect(html).toContain('pdf-print-page-doc-header');
    expect(html).toContain('pdf-print-page-doc-footer');
    expect(html).not.toContain('position: fixed');
    expect(html).toContain('Resumo da aplicação — TAF');
    expect(html).toContain('aplicador-assinatura');
  });

  it('repete cabeçalho de colunas e doc em cada bloco paginado', () => {
    const html = buildPaginatedPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: '<tr><th>NIP</th><th>Nome</th></tr>',
      rowHtml: Array.from({ length: 25 }, (_, i) => `<tr><td>${i}</td><td>Mil ${i}</td></tr>`),
      rowsFirstPage: 5,
      rowsOtherPage: 5,
      emptyColspan: 2,
      pageDocHeaderHtml: '<h1>Título</h1><p class="meta">Meta</p>',
      pageDocFooterHtml: '<div class="aplicador-assinatura">Assinatura</div>',
    });

    expect((html.match(/<thead>/g) ?? []).length).toBe(5);
    expect((html.match(/<section class="pdf-print-page">/g) ?? []).length).toBe(5);
    expect(html.match(/<th>NIP<\/th>/g)?.length).toBe(5);
    expect(html.match(/Título/g)?.length).toBe(5);
  });
});
