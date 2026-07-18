import { describe, expect, it } from 'vitest';
import { cloudRowToSyncTombstone } from '../../src/services/supabase/cloudTombstonesForSync';
import type { CloudDocRow } from '../../src/services/supabase/ownerDocs';
import {
  findRemoteTombstone,
  isRemoteTombstone,
  withTombstoneDefaults,
} from '../../src/offline-first/sync/remoteSnapshotCache';

describe('cloudRowToSyncTombstone', () => {
  it('retorna tombstone quando coluna deleted=true', () => {
    const row: CloudDocRow = {
      id: 'cad-1',
      owner_uid: 'owner',
      updated_at: 9000,
      deleted: true,
      data: {
        id: 'cad-1',
        updatedAt: 9000,
        deletedAt: 8900,
        deletedBy: 'user-a',
        syncVersion: 4,
      },
    };
    const tombstone = cloudRowToSyncTombstone(row);
    expect(tombstone).toEqual({
      id: 'cad-1',
      updatedAt: 9000,
      deleted: true,
      deletedAt: 8900,
      deletedBy: 'user-a',
      syncVersion: 4,
      updatedBy: undefined,
      deviceId: undefined,
    });
  });

  it('retorna tombstone quando deleted está só no JSON', () => {
    const row: CloudDocRow = {
      id: 'sess-1',
      owner_uid: 'owner',
      updated_at: 5000,
      deleted: false,
      data: {
        id: 'sess-1',
        updatedAt: 6000,
        deleted: true,
        version: 2,
        deviceId: 'dev-b',
      },
    };
    const tombstone = cloudRowToSyncTombstone(row);
    expect(tombstone?.id).toBe('sess-1');
    expect(tombstone?.updatedAt).toBe(6000);
    expect(tombstone?.syncVersion).toBe(2);
    expect(tombstone?.deviceId).toBe('dev-b');
  });

  it('retorna null para registro ativo', () => {
    const row: CloudDocRow = {
      id: 'cad-2',
      owner_uid: 'owner',
      updated_at: 1000,
      deleted: false,
      data: { id: 'cad-2', nome: 'Ativo', updatedAt: 1000 },
    };
    expect(cloudRowToSyncTombstone(row)).toBeNull();
  });
});

describe('remoteSnapshotCache tombstone helpers', () => {
  const snapshot = withTombstoneDefaults({
    ownerUid: 'owner',
    fetchedAt: Date.now(),
    remoteCad: [],
    remoteSess: [],
    remoteApp: [],
    remotePre: [],
    remoteCadTombstones: [
      { id: 'cad-del', updatedAt: 8000, deleted: true, deletedAt: 8000 },
    ],
    remoteSessTombstones: [],
    remoteAppTombstones: [],
  });

  it('isRemoteTombstone distingue exclusão remota de ausência', () => {
    expect(isRemoteTombstone(snapshot, 'cadastros', 'cad-del')).toBe(true);
    expect(isRemoteTombstone(snapshot, 'cadastros', 'never-existed')).toBe(false);
  });

  it('findRemoteTombstone retorna metadados do tombstone', () => {
    expect(findRemoteTombstone(snapshot, 'cadastros', 'cad-del')?.updatedAt).toBe(8000);
    expect(findRemoteTombstone(snapshot, 'sessoes', 'cad-del')).toBeUndefined();
  });
});
