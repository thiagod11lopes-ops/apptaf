import { describe, expect, it } from 'vitest';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import type { AplicadorAssinaturaResumo } from '../../src/types/aplicadorAssinatura';
import { assinaturasUnicasDasSessoes } from '../../src/utils/assinaturaAplicadorDasSessoes';
import { buildResultadosTafHtml } from '../../src/utils/exportResultadosTafPdf';
import { buildResumoAplicacaoHtml } from '../../src/utils/exportResumoAplicacaoPdf';

const assinatura: AplicadorAssinaturaResumo = {
  aplicadorId: 'app-1',
  nome: 'João Aplicador',
  nip: '11.1111.11',
  categoria: 'Oficiais',
  postoGrad: 'CT',
  rubricaSvg: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
};

describe('assinatura aplicador no PDF do histórico', () => {
  it('assinaturasUnicasDasSessoes deduplica o mesmo aplicador', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-01-01T10:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        resultados: [],
        aplicadorAssinatura: assinatura,
      },
      {
        id: 's2',
        criadoEm: '2026-01-01T11:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'natacao',
        resultados: [],
        aplicadorAssinatura: assinatura,
      },
    ];
    expect(assinaturasUnicasDasSessoes(sessoes)).toHaveLength(1);
  });

  it('buildResultadosTafHtml repete cabeçalho e assinatura do aplicador em layout de páginas', () => {
    const html = buildResultadosTafHtml(
      [
        {
          id: 'c1',
          postoGrad: 'CB',
          nip: '12.3456.78',
          nome: 'Teste',
          notaCorrida: '90',
          situacaoCorrida: 'Aprovado',
          notaCaminhada: '—',
          situacaoCaminhada: '—',
          notaNatacao: '—',
          situacaoNatacao: '—',
          permanenciaTempo: '—',
          situacaoPermanencia: '—',
        },
      ],
      'Resultados do dia — 01/01/2026',
      [assinatura],
    );
    expect(html).toContain('pdf-print-header');
    expect(html).toContain('pdf-print-footer');
    expect(html).toContain('table-header-group');
    expect(html).toContain('aplicador-assinatura');
  });

  it('buildResumoAplicacaoHtml repete cabeçalho e rubrica do aplicador em layout de páginas', () => {
    const html = buildResumoAplicacaoHtml(
      [
        {
          corredor: 1,
          nome: 'Militar Teste',
          nip: '12.3456.78',
          tempoMs: 720000,
          notaTexto: '90',
          prova: 'corrida',
        },
      ],
      'Corrida',
      'Resumo da aplicação — TAF',
      assinatura,
    );
    expect(html).toContain('pdf-print-header');
    expect(html).toContain('pdf-print-footer');
    expect(html).toContain('Resumo da aplicação — TAF');
    expect(html).toContain('<strong>Corrida</strong>');
    expect(html).toContain('aplicador-assinatura');
    expect(html).toContain('João Aplicador');
    expect(html).toContain('aplicador-rubrica');
    expect(html).toContain('<th>Corredor</th>');
    expect(html).toContain('<th>Nome</th>');
    expect(html).toContain('table-header-group');
  });

  it('buildResumoAplicacaoHtml pagina com 12 linhas por folha e repete titulos das colunas', () => {
    const resultados = Array.from({ length: 25 }, (_, index) => ({
      corredor: index + 1,
      nome: `Militar ${index + 1}`,
      nip: '12.3456.78',
      tempoMs: 720000,
      notaTexto: '90',
      prova: 'corrida' as const,
    }));
    const html = buildResumoAplicacaoHtml(resultados, 'Corrida');
    expect((html.match(/<section class="pdf-print-page-block">/g) ?? []).length).toBe(3);
    expect((html.match(/pdf-print-top-gap/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((html.match(/<thead>/g) ?? []).length).toBe(3);
    expect((html.match(/<th>Corredor<\/th>/g) ?? []).length).toBe(3);
    expect((html.match(/<th>NIP<\/th>/g) ?? []).length).toBe(3);
    expect((html.match(/<th>Tempo<\/th>/g) ?? []).length).toBe(3);
    expect((html.match(/<th class="col-rubrica">Rúbrica<\/th>/g) ?? []).length).toBe(3);
  });
});
