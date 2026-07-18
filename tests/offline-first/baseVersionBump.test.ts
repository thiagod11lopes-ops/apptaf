import { describe, expect, it } from 'vitest';
import { bumpRecordMeta, markRecordSynced } from '../../src/offline-first/sync/recordMeta';
import type { CadastroRecord } from '../../src/offline-first/types';

function cad(overrides: Partial<CadastroRecord> = {}): CadastroRecord {
  return {
    id: 'c1',
    ownerUid: 'owner',
    nip: '12345678',
    nome: 'Militar',
    postoGrad: 'MN',
    createdAt: 1000,
    updatedAt: 1000,
    version: 3,
    syncVersion: 3,
    deviceId: 'dev-old',
    userId: 'u1',
    syncStatus: 'synced',
    deleted: false,
    lastModifiedBy: 'dev-old',
    lastSync: 2000,
    ...overrides,
  } as CadastroRecord;
}

describe('bumpRecordMeta baseVersion', () => {
  it('congela syncVersion atual antes do incremento em UPDATE de registro sincronizado', () => {
    const next = bumpRecordMeta(cad({ syncVersion: 3, version: 3, syncStatus: 'synced' }), 'dev-a', 'u1', 'UPDATE');
    expect(next.baseVersion).toBe(3);
    expect(next.syncVersion).toBe(4);
    expect(next.version).toBe(4);
  });

  it('congela syncVersion atual em DELETE de registro sincronizado', () => {
    const next = bumpRecordMeta(cad({ syncVersion: 5, version: 5 }), 'dev-a', 'u1', 'DELETE');
    expect(next.baseVersion).toBe(5);
    expect(next.syncVersion).toBe(6);
    expect(next.deleted).toBe(true);
  });

  it('não sobrescreve baseVersion já definida em edições locais seguintes', () => {
    const first = bumpRecordMeta(cad({ syncVersion: 3, version: 3 }), 'dev-a', 'u1', 'UPDATE');
    expect(first.baseVersion).toBe(3);
    expect(first.syncStatus).toBe('updated');

    const second = bumpRecordMeta(first, 'dev-a', 'u1', 'UPDATE');
    expect(second.baseVersion).toBe(3);
    expect(second.syncVersion).toBe(5);
  });

  it('não define baseVersion em CREATE', () => {
    const next = bumpRecordMeta(cad({ syncVersion: 1, version: 1, syncStatus: 'local', lastSync: undefined }), 'dev-a', 'u1', 'CREATE');
    expect(next.baseVersion).toBeUndefined();
    expect(next.syncVersion).toBe(1);
  });

  it('não define baseVersion em UPDATE de registro nunca sincronizado', () => {
    const next = bumpRecordMeta(
      cad({ syncVersion: 1, version: 1, syncStatus: 'local', lastSync: undefined, baseVersion: undefined }),
      'dev-a',
      'u1',
      'UPDATE',
    );
    expect(next.baseVersion).toBeUndefined();
    expect(next.syncVersion).toBe(2);
  });
});

describe('markRecordSynced baseVersion', () => {
  it('alinha baseVersion à syncVersion atual após sync bem-sucedida', () => {
    const pending = bumpRecordMeta(cad({ syncVersion: 3, version: 3, syncStatus: 'synced' }), 'dev-a', 'u1', 'UPDATE');
    expect(pending.baseVersion).toBe(3);
    expect(pending.syncVersion).toBe(4);
    expect(pending.syncStatus).toBe('updated');

    const synced = markRecordSynced(pending, 'u1');
    expect(synced.syncStatus).toBe('synced');
    expect(synced.syncVersion).toBe(4);
    expect(synced.baseVersion).toBe(4);
    expect(typeof synced.lastSync).toBe('number');
  });

  it('define baseVersion em download/import marcado como synced', () => {
    const remote = cad({ syncVersion: 7, version: 7, syncStatus: 'updated', baseVersion: undefined, lastSync: undefined });
    const synced = markRecordSynced(remote, 'u1');
    expect(synced.baseVersion).toBe(7);
    expect(synced.syncVersion).toBe(7);
  });
});
