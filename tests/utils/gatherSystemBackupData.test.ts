import { describe, expect, it } from 'vitest';
import {
  isDemoAplicadorId,
  isDemoCadastroId,
  isDemoSessaoId,
  stripDemoDataFromBackupPayload,
  type SystemBackupPayload,
} from '../../src/utils/gatherSystemBackupData';
import { DEMO_APLICADOR_ID } from '../../src/utils/gerarDadosDemonstracaoTaf';

const emptyPayload = (): SystemBackupPayload => ({
  cadastros: [],
  sessoes: [],
  aplicadores: [],
  preCadastros: [],
  authorizedEmails: [],
  syncQueue: [],
  appMeta: [],
});

describe('stripDemoDataFromBackupPayload', () => {
  it('identifica ids de demonstração', () => {
    expect(isDemoCadastroId('demo-cad-0')).toBe(true);
    expect(isDemoCadastroId('real-1')).toBe(false);
    expect(isDemoSessaoId('demo-sess-2')).toBe(true);
    expect(isDemoAplicadorId(DEMO_APLICADOR_ID)).toBe(true);
    expect(isDemoAplicadorId('demo-aplicador-x')).toBe(true);
    expect(isDemoAplicadorId('aplicador-1')).toBe(false);
  });

  it('remove cadastros, sessões, aplicadores e meta do modo exemplo', () => {
    const payload = stripDemoDataFromBackupPayload({
      ...emptyPayload(),
      cadastros: [
        {
          id: 'demo-cad-0',
          nip: '10.0000.00',
          nome: 'Demo',
          dataNascimento: '01/01/1990',
          categoria: 'Praças',
        },
        {
          id: 'real-1',
          nip: '12.3456.78',
          nome: 'Real',
          dataNascimento: '01/01/1985',
          categoria: 'Praças',
        },
      ],
      sessoes: [
        {
          id: 'demo-sess-0',
          criadoEm: '2026-01-01T00:00:00.000Z',
          dataAplicacao: '01/01/2026',
          tipoProva: 'corrida',
          resultados: [],
        },
        {
          id: 'sess-real',
          criadoEm: '2026-01-02T00:00:00.000Z',
          dataAplicacao: '02/01/2026',
          tipoProva: 'natacao',
          resultados: [],
        },
      ],
      aplicadores: [
        {
          id: DEMO_APLICADOR_ID,
          nip: '99.9999.99',
          nome: 'Aplicador Demonstração',
          categoria: 'Praças',
        },
        {
          id: 'aplicador-real',
          nip: '11.1111.11',
          nome: 'Aplicador Real',
          categoria: 'Praças',
        },
      ],
      appMeta: [
        { key: 'demo:modoAtivo', value: '1' },
        { key: 'demo:backupId', value: '9' },
        { key: 'ui:themeMode', value: 'dark' },
      ],
    });

    expect(payload.cadastros).toHaveLength(1);
    expect(payload.cadastros[0]?.id).toBe('real-1');
    expect(payload.sessoes).toHaveLength(1);
    expect(payload.sessoes[0]?.id).toBe('sess-real');
    expect(payload.aplicadores).toHaveLength(1);
    expect(payload.aplicadores[0]?.id).toBe('aplicador-real');
    expect(payload.appMeta).toEqual([{ key: 'ui:themeMode', value: 'dark' }]);
  });
});
