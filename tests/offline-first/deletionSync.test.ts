import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bumpRecordMeta } from '../../src/offline-first/sync/recordMeta';
import { decideLastWriteWins } from '../../src/offline-first/sync/lastWriteWins';
import {
  buildFirestoreTombstone,
  DELETION_RETENTION_MS,
  isEligibleForLocalGarbageCollection,
  remoteDocToSyncRecord,
  readRemoteDeleted,
} from '../../src/offline-first/sync/tombstone';
import { softDeleteCadastro, saveCadastro, listCadastros } from '../../src/offline-first/db/localDb';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { setAuthUidState } from '../../src/services/firebase/authUid';
import type { CadastroRecord } from '../../src/offline-first/types';

const OWNER = 'owner-del-sync';
const USER = 'user-del';

function cad(partial: Partial<CadastroRecord>): CadastroRecord {
  return {
    id: 'cad-1',
    nip: '1234',
    nome: 'Teste',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: OWNER,
    createdAt: 1000,
    updatedAt: 1000,
    syncVersion: 1,
    version: 1,
    deviceId: 'dev-a',
    userId: USER,
    updatedBy: USER,
    syncStatus: 'updated',
    deleted: false,
    lastModifiedBy: 'dev-a',
    ...partial,
  };
}

describe('Exclusões — Last Write Wins', () => {
  it('exclusão local mais recente vence → upload', () => {
    const local = bumpRecordMeta(cad({ updatedAt: 9000 }), 'dev-a', USER, 'DELETE');
    const remote = cad({ updatedAt: 4000, syncStatus: 'synced' });
    expect(decideLastWriteWins(local, remote).action).toBe('upload');
    expect(local.deleted).toBe(true);
    expect(local.syncStatus).toBe('deleted');
  });

  it('exclusão remota mais recente vence → download', () => {
    const local = cad({ updatedAt: 2000, nome: 'Ativo local' });
    const remote = remoteDocToSyncRecord(
      {
        id: 'cad-1',
        nip: '1234',
        nome: 'Teste',
        updatedAt: 8000,
        deleted: true,
        deletedAt: 8000,
        syncVersion: 3,
      },
      OWNER,
    );
    expect(decideLastWriteWins(local, remote).action).toBe('download');
    expect(remote.deleted).toBe(true);
  });

  it('edição mais recente que exclusão remota vence → upload', () => {
    const local = bumpRecordMeta(cad({ updatedAt: 10_000, nome: 'Editado depois' }), 'dev-b', USER, 'UPDATE');
    const remote = remoteDocToSyncRecord(
      { id: 'cad-1', updatedAt: 7000, deleted: true, deletedAt: 7000 },
      OWNER,
    );
    expect(decideLastWriteWins(local, remote).action).toBe('upload');
    expect(local.deleted).toBe(false);
  });

  it('exclusão mais recente que edição local vence → upload da tombstone', () => {
    const local = bumpRecordMeta(cad({ updatedAt: 12_000, nome: 'Foi apagado' }), 'dev-a', USER, 'DELETE');
    const remote = remoteDocToSyncRecord(
      { id: 'cad-1', updatedAt: 9000, nome: 'Versão remota antiga' },
      OWNER,
    );
    expect(decideLastWriteWins(local, remote).action).toBe('upload');
  });

  it('exclusões simultâneas com mesmo updatedAt → skip (empate)', () => {
    const at = 5000;
    const local = {
      ...bumpRecordMeta(cad({ updatedAt: at }), 'dev-a', USER, 'DELETE'),
      updatedAt: at,
      deletedAt: at,
      syncVersion: 2,
    };
    const remote = remoteDocToSyncRecord(
      { id: 'cad-1', updatedAt: at, deleted: true, deletedAt: at, syncVersion: 2 },
      OWNER,
    );
    expect(decideLastWriteWins(local, remote).action).toBe('skip');
  });

  it('somente remoto excluído → download tombstone', () => {
    const remote = remoteDocToSyncRecord(
      { id: 'cad-x', updatedAt: 6000, deleted: true, deletedAt: 6000 },
      OWNER,
    );
    expect(decideLastWriteWins(undefined, remote).action).toBe('download');
  });

  it('buildFirestoreTombstone preserva metadados de exclusão', () => {
    const deleted = bumpRecordMeta(cad({ updatedAt: 3000 }), 'dev-c', USER, 'DELETE');
    const tombstone = buildFirestoreTombstone(deleted);
    expect(tombstone.deleted).toBe(true);
    expect(tombstone.deletedAt).toBeGreaterThan(0);
    expect(tombstone.updatedAt).toBe(deleted.updatedAt);
    expect(tombstone.syncVersion).toBe(deleted.syncVersion);
  });

  it('readRemoteDeleted detecta flag remota', () => {
    expect(readRemoteDeleted({ deleted: true })).toBe(true);
    expect(readRemoteDeleted({ deleted: false })).toBe(false);
  });
});

describe('Exclusões — garbage collection', () => {
  it('elegível após retenção e sync', () => {
    const oldDeletedAt = Date.now() - DELETION_RETENTION_MS - 1000;
    const old = bumpRecordMeta(cad({}), 'dev-a', USER, 'DELETE');
    old.syncStatus = 'synced';
    old.deletedAt = oldDeletedAt;
    old.updatedAt = oldDeletedAt;
    expect(isEligibleForLocalGarbageCollection(old, new Set(), 'cadastros')).toBe(true);
  });

  it('não elegível com sync pendente', () => {
    const row = bumpRecordMeta(cad({}), 'dev-a', USER, 'DELETE');
    row.syncStatus = 'synced';
    row.deletedAt = Date.now() - DELETION_RETENTION_MS - 1000;
    expect(isEligibleForLocalGarbageCollection(row, new Set(['cadastros:cad-1']), 'cadastros')).toBe(false);
  });

  it('não elegível antes da retenção', () => {
    const row = bumpRecordMeta(cad({}), 'dev-a', USER, 'DELETE');
    row.syncStatus = 'synced';
    expect(isEligibleForLocalGarbageCollection(row, new Set(), 'cadastros')).toBe(false);
  });
});

describe('Exclusões — soft delete local', () => {
  beforeEach(() => {
    setAuthUidState(USER, OWNER, true);
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
  });

  it('soft delete mantém registro no Dexie com deleted=true', async () => {
    await saveCadastro(
      {
        id: 'cad-soft',
        nip: '99',
        nome: 'Militar',
        dataNascimento: '01/01/1990',
        categoria: 'Praças',
      },
      OWNER,
      USER,
    );

    await softDeleteCadastro('cad-soft', OWNER, USER);

    const visible = await listCadastros(OWNER, false);
    expect(visible.find((r) => r.id === 'cad-soft')).toBeUndefined();

    const all = await listCadastros(OWNER, true);
    const tombstone = all.find((r) => r.id === 'cad-soft');
    expect(tombstone?.deleted).toBe(true);
    expect(tombstone?.syncStatus).toBe('deleted');
    expect(tombstone?.deletedAt).toBeGreaterThan(0);
    expect(tombstone?.updatedBy).toBe(USER);
  });
});

describe('Exclusões — multi-dispositivo (simulação LWW)', () => {
  it('dispositivo B recebe exclusão do dispositivo A quando remota é mais recente', () => {
    const deviceA = bumpRecordMeta(cad({ updatedAt: 15_000 }), 'dev-a', USER, 'DELETE');
    const deviceBLocal = cad({ updatedAt: 10_000, deviceId: 'dev-b', nome: 'Cópia B' });

    const decision = decideLastWriteWins(deviceBLocal, remoteDocToSyncRecord(
      { ...deviceA, id: 'cad-1', nip: '1234', nome: 'Teste' },
      OWNER,
    ));

    expect(decision.action).toBe('download');
  });

  it('dispositivo B mantém edição se for mais recente que exclusão remota', () => {
    const remoteDelete = remoteDocToSyncRecord(
      { id: 'cad-1', updatedAt: 5000, deleted: true, deletedAt: 5000 },
      OWNER,
    );
    const deviceBEdit = bumpRecordMeta(
      cad({ updatedAt: 8000, deviceId: 'dev-b', nome: 'Salvo offline depois' }),
      'dev-b',
      USER,
      'UPDATE',
    );

    expect(decideLastWriteWins(deviceBEdit, remoteDelete).action).toBe('upload');
  });
});
