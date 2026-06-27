import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { saveCadastro, saveSessao } from '../../src/offline-first/db/localDb';
import { getPendingSyncItems } from '../../src/offline-first/sync/pendingSyncItems';
import { systemState, SYSTEM_STATE } from '../../src/offline-first/sync/SystemState';
import { setAuthUidState } from '../../src/services/firebase/authUid';

const OWNER = 'owner-sync-gate';

describe('getPendingSyncItems', () => {
  beforeEach(() => {
    setAuthUidState('login-1', OWNER, true);
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
    await systemState.setOfflineMode();
  });

  it('retorna registros com syncStatus não sincronizado', async () => {
    await saveCadastro(
      {
        id: 'cad-p1',
        nip: '111',
        nome: 'Pendente',
        dataNascimento: '01/01/1990',
        categoria: 'Praças',
      },
      OWNER,
      'login-1',
    );
    await saveSessao(
      {
        id: 'sess-p1',
        criadoEm: new Date().toISOString(),
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        resultados: [],
      },
      OWNER,
      'login-1',
    );

    const summary = await getPendingSyncItems(OWNER);
    expect(summary.total).toBe(2);
    expect(summary.cadastros).toBe(1);
    expect(summary.sessoes).toBe(1);
  });
});

describe('systemState', () => {
  afterEach(async () => {
    await systemState.setOfflineMode();
  });

  it('inicia offline e bloqueia Firebase até modo online', async () => {
    await systemState.hydrate();
    expect(systemState.getMode()).toBe(SYSTEM_STATE.OFFLINE);
    expect(systemState.canUseFirebase()).toBe(false);
    await systemState.setOnlineMode();
    expect(systemState.canUseFirebase()).toBe(true);
  });
});
