import { describe, expect, it } from 'vitest';
import { buildPdfLandscapeDocument } from '../../src/utils/pdfLayout';

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
    expect(html).toContain('Resumo da aplicação — TAF');
    expect(html).toContain('aplicador-assinatura');
  });
});
