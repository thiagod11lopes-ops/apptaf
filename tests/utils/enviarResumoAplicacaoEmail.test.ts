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

describe('enviarResumoAplicacaoEmail', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('monta assunto e corpo com prova e quantidade', async () => {
    const { montarAssuntoEmailResumo, montarCorpoEmailResumo } = await import(
      '../../src/utils/enviarResumoAplicacaoEmail'
    );

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

    expect(montarAssuntoEmailResumo(resultados)).toContain('Corrida');
    expect(montarCorpoEmailResumo(resultados)).toContain('Participantes: 2');
  });

  it('prepara anexo e compartilha resultados', async () => {
    const {
      montarConteudoEmailResumoSync,
      prepararAnexoEmailResumo,
      compartilharResultadosAnexo,
      urlMailto,
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
    ];

    const base = montarConteudoEmailResumoSync(resultados, 'Corrida');
    expect(base.html).toContain('Resumo da aplicação');
    expect(urlMailto(base.subject, base.body).startsWith('mailto:')).toBe(true);

    const pronto = await prepararAnexoEmailResumo(resultados, 'Corrida');
    expect(pronto.filename.toLowerCase().endsWith('.pdf')).toBe(true);

    const resultado = await compartilharResultadosAnexo(pronto);
    expect(resultado.mensagem.toLowerCase()).toMatch(/aplicativo|anexado|e-mail/);
  });
});
