import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { listSessoes } from '../../src/offline-first/db/localDb';
import { resetAppMetaCacheForTests } from '../../src/offline-first/db/appMeta';
import {
  resetAuthUidStateForTests,
  setAuthUidState,
} from '../../src/services/firebase/authUid';
import { dataStore } from '../../src/offline-first/store/DataStore';
import { wipeAllModoTesteSessoes } from '../../src/services/wipePartialDangerData';

const OWNER_UID = 'wipe-modo-teste-owner';

describe('wipeAllModoTesteSessoes', () => {
  beforeEach(() => {
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
    setAuthUidState(null, OWNER_UID, true);
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
  });

  it('apaga só sessões demo-sess-* e preserva sessões reais', async () => {
    await dataStore.upsertSessao(
      {
        id: 'sessao-real-1',
        criadoEm: new Date().toISOString(),
        dataAplicacao: '27/07/2026',
        tipoProva: 'corrida',
        resultados: [],
        normaTaf: 'armada',
      },
      OWNER_UID,
    );
    await dataStore.upsertSessao(
      {
        id: 'demo-sess-100',
        criadoEm: new Date().toISOString(),
        dataAplicacao: '27/07/2026',
        tipoProva: 'natacao',
        resultados: [],
        normaTaf: 'armada',
      },
      OWNER_UID,
    );
    await dataStore.upsertSessao(
      {
        id: 'demo-sess-200',
        criadoEm: new Date().toISOString(),
        dataAplicacao: '27/07/2026',
        tipoProva: 'permanencia',
        resultados: [],
        normaTaf: 'cfn',
      },
      OWNER_UID,
    );

    const result = await wipeAllModoTesteSessoes({ uid: OWNER_UID });
    expect(result.sessoesDeleted).toBe(2);

    const remaining = await listSessoes(OWNER_UID, true);
    expect(remaining.some((s) => s.id === 'sessao-real-1')).toBe(true);
    expect(remaining.every((s) => !s.id.startsWith('demo-sess-'))).toBe(true);
  });
});
