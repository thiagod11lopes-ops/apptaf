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
    await systemState.setOnlineActive();
  });

  it('retorna registros com syncStatus pending', async () => {
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
    expect(summary.items.every((i) => i.syncStatus === 'pending')).toBe(true);
  });
});

describe('systemState', () => {
  afterEach(async () => {
    await systemState.setOnlineActive();
  });

  it('FORCED_OFFLINE bloqueia Firebase', async () => {
    await systemState.setForcedOffline();
    expect(systemState.getMode()).toBe(SYSTEM_STATE.FORCED_OFFLINE);
    expect(systemState.canUseFirebase()).toBe(false);
  });
});
