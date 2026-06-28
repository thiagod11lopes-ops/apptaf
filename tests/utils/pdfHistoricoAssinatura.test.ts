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

  it('buildResultadosTafHtml inclui bloco de assinatura do aplicador', () => {
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
    expect(html).toContain('aplicador-assinatura');
    expect(html).toContain('João Aplicador');
    expect(html).toContain('NIP 11.1111.11');
  });

  it('buildResumoAplicacaoHtml inclui rubrica do aplicador ao abrir sessão do histórico', () => {
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
    expect(html).toContain('aplicador-assinatura');
    expect(html).toContain('João Aplicador');
    expect(html).toContain('aplicador-rubrica');
    expect(html).toContain('<strong>Corrida</strong>');
  });
});
