import { describe, expect, it } from 'vitest';
import {
  buildPdfLandscapeDocument,
  buildPdfTableHtml,
  estimarFolhasPdfPorLinhas,
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
    expect(html).not.toContain('pdf-print-page');
    expect(html).toContain('Resumo da aplicação — TAF');
    expect(html).toContain('aplicador-assinatura');
  });

  it('usa tabela única com thead para quebra automática de linhas', () => {
    const html = buildPdfTableHtml({
      tableClass: 'resultados-taf',
      theadHtml: '<tr><th>NIP</th><th>Nome</th></tr>',
      rowHtml: Array.from({ length: 25 }, (_, i) => `<tr><td>${i}</td><td>Mil ${i}</td></tr>`),
      emptyColspan: 2,
    });

    expect((html.match(/<table/g) ?? []).length).toBe(1);
    expect((html.match(/<thead>/g) ?? []).length).toBe(1);
    expect(html.match(/<tr>/g)?.length).toBe(26);
  });

  it('estima folhas com base na área útil da página', () => {
    expect(estimarFolhasPdfPorLinhas(50, 44, 0, true)).toBeGreaterThan(1);
    expect(estimarFolhasPdfPorLinhas(3, 44, 0, true)).toBe(1);
  });
});
