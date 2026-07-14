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

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///tmp/',
  writeAsStringAsync: async () => undefined,
  getContentUriAsync: async (uri: string) => uri,
}));

vi.mock('../../src/utils/gatherSystemBackupData', () => ({
  gatherSystemBackupData: async () => ({
    cadastros: [],
    sessoes: [],
    aplicadores: [],
    preCadastros: [],
    authorizedEmails: [],
    syncQueue: [],
    appMeta: [],
  }),
}));

describe('enviarResumoAplicacaoEmail', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('monta assunto e corpo mencionando PDF e CSV', async () => {
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
    const corpo = montarCorpoEmailResumo(resultados);
    expect(corpo).toContain('Participantes: 2');
    expect(corpo).toContain('CSV');
    expect(corpo).toContain('PDF');
  });

  it('prepara PDF e CSV de backup e compartilha', async () => {
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
    expect(pronto.csvFilename.toLowerCase().endsWith('.csv')).toBe(true);
    expect(pronto.csvContent).toContain('TAF_BACKUP_VERSION');
    expect(pronto.csvUri || pronto.webFiles?.length).toBeTruthy();

    const resultado = await compartilharResultadosAnexo(pronto);
    expect(resultado.mensagem.toLowerCase()).toMatch(/csv|pdf|backup|anexad/);
  });
});
