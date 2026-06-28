import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests, setMeta } from '../../src/offline-first/db/tafDatabase';
import { importCadastroRecord, listCadastrosForDisplay } from '../../src/offline-first/db/localDb';
import type { CadastroRecord } from '../../src/offline-first/types';
import {
  resetAppMetaCacheForTests,
  hydrateAppMetaFromIndexedDb,
} from '../../src/offline-first/db/appMeta';
import {
  getCachedDataOwnerUid,
  hydrateAuthUidFromIndexedDb,
  isAuthUidReady,
  resetAuthUidStateForTests,
  resolveStorageOwnerUid,
  setAuthUidState,
} from '../../src/services/firebase/authUid';

const OWNER = 'offline-owner-uid';

function cadastroRecord(id: string): CadastroRecord {
  return {
    id,
    nip: '12345678',
    nome: 'Teste Offline',
    dataNascimento: '01/01/1995',
    categoria: 'Praças',
    ownerUid: OWNER,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncVersion: 1,
    version: 1,
    deviceId: 'test',
    userId: null,
    updatedBy: 'test',
    lastModifiedBy: 'test',
    syncStatus: 'synced',
    deleted: false,
  };
}

describe('resolveStorageOwnerUid — sessão offline após logout/reload', () => {
  beforeEach(async () => {
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
    setAuthUidState(null, null, false);
    await setMeta('session:dataOwnerUid', OWNER);
    await importCadastroRecord(cadastroRecord('cad-offline-1'));
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
  });

  it('resolve owner sem authReady após hidratação (simula reload sem login)', async () => {
    await hydrateAppMetaFromIndexedDb();
    await hydrateAuthUidFromIndexedDb();

    expect(isAuthUidReady()).toBe(false);

    const owner = await resolveStorageOwnerUid();
    expect(owner).toBe(OWNER);
  });

  it('listCadastrosForDisplay encontra dados do owner persistido sem login', async () => {
    setAuthUidState(null, OWNER, true);
    const rows = await listCadastrosForDisplay(getCachedDataOwnerUid());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.nome).toBe('Teste Offline');
  });
});
