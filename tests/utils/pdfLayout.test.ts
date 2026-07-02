import { describe, expect, it } from 'vitest';
import { buildPdfLandscapeDocument, buildPaginatedPdfTableHtml } from '../../src/utils/pdfLayout';

describe('pdfLayout', () => {
  it('gera documento A4 paisagem com cabeçalho e rodapé fixos', () => {
    const html = buildPdfLandscapeDocument({
      documentTitle: 'Teste',
      titulo: 'Resumo da aplicação — TAF',
      metaHtml: 'Gerado em 28/06/2026 · <strong>Corrida</strong>',
      conteudoHtml: '<table><tr><td>Linha</td></tr></table>',
      aplicadorHtml: '<div class="aplicador-assinatura">Assinatura</div>',
    });
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('pdf-print-header');
    expect(html).toContain('pdf-print-footer');
    expect(html).toContain('overflow: visible');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('Resumo da aplicação — TAF');
    expect(html).toContain('aplicador-assinatura');
  });

  it('repete cabeçalho de colunas em cada bloco paginado', () => {
    const html = buildPaginatedPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: '<tr><th>NIP</th><th>Nome</th></tr>',
      rowHtml: Array.from({ length: 25 }, (_, i) => `<tr><td>${i}</td><td>Mil ${i}</td></tr>`),
      rowsFirstPage: 9,
      rowsOtherPage: 10,
      emptyColspan: 2,
    });

    expect((html.match(/<thead>/g) ?? []).length).toBe(3);
    expect(html).toContain('pdf-table-continuacao');
    expect(html.match(/<th>NIP<\/th>/g)?.length).toBe(3);
  });
});
