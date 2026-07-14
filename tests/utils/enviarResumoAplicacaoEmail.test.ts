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

  it('prepara anexo em silêncio e monta URLs de composer', async () => {
    const {
      urlComposerParaProvedor,
      montarConteudoEmailResumoSync,
      prepararAnexoEmailResumo,
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
    const gmail = urlComposerParaProvedor('gmail', base.subject, base.body);
    const outros = urlComposerParaProvedor('outros', base.subject, base.body);
    expect(gmail).toMatch(/mail\.google\.com|mailto:/);
    expect(outros.startsWith('mailto:')).toBe(true);
    expect(base.html).toContain('Resumo da aplicação');

    const pronto = await prepararAnexoEmailResumo(resultados, 'Corrida');
    // Em ambiente de teste (sem web File), o PDF nativo mocked deve ter uri.
    expect(pronto.uri === '' || pronto.uri.startsWith('file://')).toBe(true);
    expect(pronto.filename.toLowerCase().endsWith('.pdf')).toBe(true);
  });
});
