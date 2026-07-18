import { describe, expect, it } from 'vitest';
import { decideLastWriteWins } from '../../src/offline-first/sync/lastWriteWins';
import {
  mergeRemoteMapWithTombstones,
  tombstonePayloadToSyncRecord,
} from '../../src/offline-first/sync/lastWriteWinsSync';
import { remoteDocToSyncRecord } from '../../src/offline-first/sync/tombstone';
import type { CadastroRecord } from '../../src/offline-first/types';
import type { TombstonePayload } from '../../src/offline-first/sync/tombstone';

const OWNER = 'owner-tombstone-lww';

function localActive(partial: Partial<CadastroRecord> = {}): CadastroRecord {
  return {
    id: 'cad-1',
    nip: '1234',
    nome: 'Ativo local',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: OWNER,
    createdAt: 1000,
    updatedAt: 5000,
    syncVersion: 2,
    version: 2,
    deviceId: 'dev-local',
    userId: 'u1',
    updatedBy: 'u1',
    syncStatus: 'synced',
    deleted: false,
    lastModifiedBy: 'dev-local',
    ...partial,
  };
}

describe('mergeRemoteMapWithTombstones → LWW', () => {
  it('local ativo + sem remoto: comportamento atual (somente_local → upload)', () => {
    const remoteMap = mergeRemoteMapWithTombstones(new Map(), [], OWNER);
    const local = localActive();
    const remote = remoteMap.get(local.id);
    expect(remote).toBeUndefined();
    expect(decideLastWriteWins(local, remote).action).toBe('upload');
    expect(decideLastWriteWins(local, remote).reason).toBe('somente_local');
  });

  it('local ativo + tombstone remoto: LWW recebe deleted=true (não ausência)', () => {
    const tombstone: TombstonePayload = {
      id: 'cad-1',
      updatedAt: 9000,
      deleted: true,
      deletedAt: 9000,
      deletedBy: 'user-a',
      syncVersion: 4,
      updatedBy: 'user-a',
      deviceId: 'dev-a',
    };
    const remoteMap = mergeRemoteMapWithTombstones(new Map(), [tombstone], OWNER);
    const remote = remoteMap.get('cad-1');
    expect(remote).toBeDefined();
    expect(remote?.deleted).toBe(true);
    expect(remote?.updatedAt).toBe(9000);
    expect(remote?.syncVersion).toBe(4);

    const local = localActive({ updatedAt: 5000, syncVersion: 2 });
    const decision = decideLastWriteWins(local, remote);
    expect(decision.action).toBe('download');
    expect(decision.reason).toBe('remoto_updatedAt_mais_recente');
  });

  it('tombstone remoto mais antigo: LWW decide normalmente (upload da edição local)', () => {
    const tombstone: TombstonePayload = {
      id: 'cad-1',
      updatedAt: 3000,
      deleted: true,
      deletedAt: 3000,
      syncVersion: 2,
    };
    const remote = tombstonePayloadToSyncRecord(tombstone, OWNER);
    const local = localActive({ updatedAt: 10_000, syncVersion: 5, nome: 'Editado depois' });
    const decision = decideLastWriteWins(local, remote);
    expect(decision.action).toBe('upload');
    expect(local.deleted).toBe(false);
  });

  it('registro ativo remoto não é sobrescrito por tombstone do mesmo id', () => {
    const activeRemote = remoteDocToSyncRecord(
      {
        id: 'cad-1',
        nip: '1234',
        nome: 'Ativo nuvem',
        updatedAt: 7000,
        syncVersion: 3,
        deleted: false,
      },
      OWNER,
    );
    const remoteMap = new Map<string, typeof activeRemote>([['cad-1', activeRemote]]);
    mergeRemoteMapWithTombstones(
      remoteMap,
      [{ id: 'cad-1', updatedAt: 9999, deleted: true, deletedAt: 9999, syncVersion: 9 }],
      OWNER,
    );
    expect(remoteMap.get('cad-1')?.deleted).toBe(false);
    expect(remoteMap.get('cad-1')?.updatedAt).toBe(7000);
    expect(remoteMap.get('cad-1')?.nome).toBe('Ativo nuvem');
  });

  it('registros sem exclusão: mapa remoto ativo permanece igual', () => {
    const active = remoteDocToSyncRecord(
      { id: 'cad-2', nome: 'Ok', updatedAt: 4000, syncVersion: 1 },
      OWNER,
    );
    const remoteMap = new Map([['cad-2', active]]);
    mergeRemoteMapWithTombstones(remoteMap, [], OWNER);
    expect(remoteMap.size).toBe(1);
    expect(remoteMap.get('cad-2')?.deleted).toBe(false);
    expect(decideLastWriteWins(localActive({ id: 'cad-2', updatedAt: 2000 }), remoteMap.get('cad-2')).action).toBe(
      'download',
    );
  });
});
