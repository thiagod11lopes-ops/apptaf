import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-mail-composer', () => ({
  getClients: () => [],
  isAvailableAsync: async () => true,
  composeAsync: async () => ({ status: 'sent' }),
}));

vi.mock('expo-print', () => ({
  printToFileAsync: async () => ({ uri: 'file:///tmp/resumo.pdf' }),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => undefined,
}));

vi.mock('expo-intent-launcher', () => ({
  startActivityAsync: async () => undefined,
}));

describe('enviarResumoAplicacaoEmail', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('monta assunto e corpo com prova e quantidade', async () => {
    const {
      montarAssuntoEmailResumo,
      montarCorpoEmailResumo,
    } = await import('../../src/utils/enviarResumoAplicacaoEmail');

    const resultados = [
      {
        corredor: 1,
        nome: 'Militar A',
        nip: '12.3456.78',
        tempoMs: 720000,
        notaTexto: '90',
        prova: 'corrida' as const,
      },
      {
        corredor: 2,
        nome: 'Militar B',
        nip: '12.3456.79',
        tempoMs: 740000,
        notaTexto: '85',
        prova: 'corrida' as const,
      },
    ];

    const assunto = montarAssuntoEmailResumo(resultados);
    expect(assunto).toContain('Resultados TAF');
    expect(assunto).toContain('Corrida');

    const corpo = montarCorpoEmailResumo(resultados);
    expect(corpo).toContain('Prova: Corrida');
    expect(corpo).toContain('Participantes: 2');
    expect(corpo).toContain('anexo');
  });

  it('lista Gmail, Zimbra e Outros', async () => {
    const { listarOpcoesEmailResultado } = await import(
      '../../src/utils/enviarResumoAplicacaoEmail'
    );
    const opcoes = await listarOpcoesEmailResultado();
    expect(opcoes.map((o) => o.id)).toEqual(['gmail', 'zimbra', 'outros']);
  });

  it('na web prepara HTML sem exigir print nativo', async () => {
    const { prepararPdfResumoAplicacao } = await import(
      '../../src/utils/enviarResumoAplicacaoEmail'
    );
    const pdf = await prepararPdfResumoAplicacao(
      [
        {
          corredor: 1,
          nome: 'Militar A',
          nip: '12.3456.78',
          tempoMs: 720000,
          notaTexto: '90',
          prova: 'corrida',
        },
      ],
      'Corrida',
    );
    expect(pdf.html).toContain('Resumo da aplicação');
    expect(pdf.subject).toContain('Corrida');
    expect(pdf.body).toContain('Participantes: 1');
  });
});
