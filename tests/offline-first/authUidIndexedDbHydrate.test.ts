import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests, setMeta } from '../../src/offline-first/db/tafDatabase';
import { importCadastroRecord } from '../../src/offline-first/db/localDb';
import type { CadastroRecord } from '../../src/offline-first/types';
import {
  resetAppMetaCacheForTests,
  readAppMetaCache,
  migrateLegacyLocalStorageToAppMeta,
  hydrateAppMetaFromIndexedDb,
} from '../../src/offline-first/db/appMeta';
import {
  getCachedDataOwnerUid,
  hydrateAuthUidFromIndexedDb,
  resetAuthUidStateForTests,
  setAuthUidState,
} from '../../src/services/firebase/authUid';

const BOSS_UID = 'boss-pwa-owner';

function cadastroRecord(id: string): CadastroRecord {
  return {
    id,
    nip: '12345678',
    nome: 'Teste',
    dataNascimento: '01/01/1995',
    categoria: 'Praças',
    ownerUid: BOSS_UID,
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

describe('hydrateAuthUidFromIndexedDb', () => {
  beforeEach(() => {
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
    setAuthUidState(null, null, true);
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
  });

  it('restaura ownerUid do Dexie meta', async () => {
    await setMeta('session:dataOwnerUid', BOSS_UID);

    await hydrateAppMetaFromIndexedDb();
    await hydrateAuthUidFromIndexedDb();

    expect(getCachedDataOwnerUid()).toBe(BOSS_UID);
    expect(readAppMetaCache('session:dataOwnerUid')).toBe(BOSS_UID);
  });

  it('infere ownerUid dos registros locais quando meta está vazio', async () => {
    await importCadastroRecord(cadastroRecord('cad-1'));

    await hydrateAppMetaFromIndexedDb();
    await hydrateAuthUidFromIndexedDb();

    expect(getCachedDataOwnerUid()).toBe(BOSS_UID);
  });

  it('migra ownerUid legado do localStorage para Dexie meta', async () => {
    if (typeof globalThis.localStorage === 'undefined') {
      const store = new Map<string, string>();
      globalThis.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
        key: () => null,
        length: 0,
      } as Storage;
    }

    localStorage.setItem('taf:lastDataOwnerUid', BOSS_UID);
    await migrateLegacyLocalStorageToAppMeta();

    expect(readAppMetaCache('session:dataOwnerUid')).toBe(BOSS_UID);
    expect(localStorage.getItem('taf:lastDataOwnerUid')).toBeNull();
  });
});
