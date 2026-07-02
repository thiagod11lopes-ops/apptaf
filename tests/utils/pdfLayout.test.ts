import { describe, expect, it } from 'vitest';
import {
  buildPdfLandscapeDocument,
  buildPdfTableHtml,
  estimarFolhasPdfPorLinhas,
  PDF_MAX_ROWS_PER_PAGE,
  PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA,
  paginatePdfTableRows,
} from '../../src/utils/pdfLayout';

describe('pdfLayout', () => {
  it('gera documento A4 paisagem com cabeçalho fixo e tabela contínua', () => {
    const tabela = buildPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: '<tr><th>NIP</th></tr>',
      rowHtml: ['<tr><td>1</td></tr>'],
      emptyColspan: 1,
      rowsPerPage: PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA,
    });
    const html = buildPdfLandscapeDocument({
      documentTitle: 'Teste',
      titulo: 'Resumo da aplicação — TAF',
      metaHtml: 'Gerado em 28/06/2026 · <strong>Corrida</strong>',
      conteudoHtml: tabela,
      aplicadorHtml: '<div class="aplicador-assinatura">Assinatura</div>',
    });
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('pdf-print-header');
    expect(html).toContain('pdf-print-footer');
    expect(html).toContain('pdf-print-page-block--com-assinatura');
    expect(html).toContain('table-header-group');
    expect(html).toContain('Resumo da aplicação — TAF');
    expect(html).toContain('aplicador-assinatura');
  });

  it('pagina tabelas com no máximo 10 linhas por folha', () => {
    const html = buildPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: '<tr><th>NIP</th><th class="col-nome">Nome</th></tr>',
      rowHtml: Array.from({ length: 25 }, (_, i) => `<tr><td>${i}</td><td class="col-nome">Mil ${i}</td></tr>`),
      emptyColspan: 2,
    });

    expect((html.match(/<section class="pdf-print-page-block">/g) ?? []).length).toBe(3);
    expect((html.match(/<thead>/g) ?? []).length).toBe(3);
    expect(paginatePdfTableRows(Array.from({ length: 25 }, () => 'x'), PDF_MAX_ROWS_PER_PAGE)).toEqual([
      expect.arrayContaining([]),
      expect.arrayContaining([]),
      expect.arrayContaining([]),
    ]);
    expect(paginatePdfTableRows(Array.from({ length: 25 }, () => 'x'), PDF_MAX_ROWS_PER_PAGE)[0]).toHaveLength(10);
    expect(paginatePdfTableRows(Array.from({ length: 25 }, () => 'x'), PDF_MAX_ROWS_PER_PAGE)[2]).toHaveLength(5);
  });

  it('estima folhas com base em 10 linhas por página', () => {
    expect(estimarFolhasPdfPorLinhas(50)).toBe(5);
    expect(estimarFolhasPdfPorLinhas(10)).toBe(1);
    expect(estimarFolhasPdfPorLinhas(11)).toBe(2);
  });

  it('com assinatura usa 10 linhas por folha', () => {
    expect(estimarFolhasPdfPorLinhas(25, PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA)).toBe(3);
    const html = buildPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: '<tr><th>NIP</th><th class="col-nome">Nome</th></tr>',
      rowHtml: Array.from({ length: 25 }, (_, i) => `<tr><td>${i}</td><td class="col-nome">Mil ${i}</td></tr>`),
      emptyColspan: 2,
      rowsPerPage: PDF_MAX_ROWS_PER_PAGE_COM_ASSINATURA,
    });
    expect((html.match(/<tbody>/g) ?? []).length).toBe(3);
    expect(html).toContain('col-nome');
    expect(html).not.toMatch(/<tbody>\s*<\/tbody>/);
  });
});
