import { describe, expect, it } from 'vitest';
import {
  buildPdfLandscapeDocument,
  buildPdfTableHtml,
  estimarFolhasPdfPorLinhas,
  PDF_MAX_ROWS_PER_PAGE,
  paginatePdfTableRows,
} from '../../src/utils/pdfLayout';

describe('pdfLayout', () => {
  it('gera documento A4 paisagem com cabeçalho fixo e tabela contínua', () => {
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
    expect(html).toContain('table-header-group');
    expect(html).toContain('Resumo da aplicação — TAF');
    expect(html).toContain('aplicador-assinatura');
  });

  it('pagina tabelas com no máximo 12 linhas por folha', () => {
    const html = buildPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: '<tr><th>NIP</th><th>Nome</th></tr>',
      rowHtml: Array.from({ length: 25 }, (_, i) => `<tr><td>${i}</td><td>Mil ${i}</td></tr>`),
      emptyColspan: 2,
    });

    expect((html.match(/<section class="pdf-print-page-block">/g) ?? []).length).toBe(3);
    expect((html.match(/<thead>/g) ?? []).length).toBe(3);
    expect(paginatePdfTableRows(Array.from({ length: 25 }, () => 'x'), PDF_MAX_ROWS_PER_PAGE)).toEqual([
      expect.arrayContaining([]),
      expect.arrayContaining([]),
      expect.arrayContaining([]),
    ]);
    expect(paginatePdfTableRows(Array.from({ length: 25 }, () => 'x'), PDF_MAX_ROWS_PER_PAGE)[0]).toHaveLength(12);
    expect(paginatePdfTableRows(Array.from({ length: 25 }, () => 'x'), PDF_MAX_ROWS_PER_PAGE)[2]).toHaveLength(1);
  });

  it('estima folhas com base em 12 linhas por página', () => {
    expect(estimarFolhasPdfPorLinhas(50)).toBe(5);
    expect(estimarFolhasPdfPorLinhas(12)).toBe(1);
    expect(estimarFolhasPdfPorLinhas(13)).toBe(2);
  });
});
