import { describe, expect, it } from 'vitest';
import { bumpRecordMeta } from '../../src/offline-first/sync/recordMeta';
import {
  decideLastWriteWins,
  shouldSkipIdenticalRecords,
} from '../../src/offline-first/sync/lastWriteWins';
import type { CadastroRecord } from '../../src/offline-first/types';

function cad(partial: Partial<CadastroRecord>): CadastroRecord {
  return {
    id: '1',
    nip: '1234',
    nome: 'Teste',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: 'boss',
    createdAt: 1000,
    updatedAt: 1000,
    syncVersion: 1,
    version: 1,
    deviceId: 'd1',
    userId: 'u1',
    updatedBy: 'u1',
    syncStatus: 'updated',
    deleted: false,
    lastModifiedBy: 'd1',
    ...partial,
  };
}

describe('Last Write Wins', () => {
  it('local updatedAt mais recente → upload', () => {
    const local = cad({ updatedAt: 5000, nome: 'Local' });
    const remote = cad({ updatedAt: 3000, nome: 'Remoto', syncStatus: 'synced' });
    expect(decideLastWriteWins(local, remote).action).toBe('upload');
  });

  it('remoto updatedAt mais recente → download', () => {
    const local = cad({ updatedAt: 2000, nome: 'Local' });
    const remote = cad({ updatedAt: 9000, nome: 'Remoto', syncStatus: 'synced' });
    expect(decideLastWriteWins(local, remote).action).toBe('download');
  });

  it('updatedAt e syncVersion iguais → skip', () => {
    const local = cad({ updatedAt: 4000, syncVersion: 2 });
    const remote = cad({ updatedAt: 4000, syncVersion: 2, syncStatus: 'synced' });
    expect(shouldSkipIdenticalRecords(local, remote)).toBe(true);
    expect(decideLastWriteWins(local, remote).action).toBe('skip');
  });

  it('empate de updatedAt com syncVersion remoto maior → download', () => {
    const local = cad({ updatedAt: 4000, syncVersion: 2 });
    const remote = cad({ updatedAt: 4000, syncVersion: 3, syncStatus: 'synced' });
    expect(decideLastWriteWins(local, remote).action).toBe('download');
  });

  it('empate total de updatedAt e syncVersion → skip', () => {
    const local = cad({ updatedAt: 4000, syncVersion: 2 });
    const remote = cad({ updatedAt: 4000, syncVersion: 2, syncStatus: 'synced', nome: 'Outro' });
    expect(decideLastWriteWins(local, remote).action).toBe('skip');
  });

  it('exclusão local mais recente → upload', () => {
    const local = bumpRecordMeta(cad({ updatedAt: 8000 }), 'dev-a', 'u1', 'DELETE');
    const remote = cad({ updatedAt: 4000, nome: 'Ativo', syncStatus: 'synced' });
    expect(decideLastWriteWins(local, remote).action).toBe('upload');
  });

  it('exclusão remota mais recente → download', () => {
    const local = cad({ updatedAt: 2000, nome: 'Ativo' });
    const remote = cad({
      updatedAt: 9000,
      deleted: true,
      deletedAt: 9000,
      syncStatus: 'synced',
      syncVersion: 4,
    });
    expect(decideLastWriteWins(local, remote).action).toBe('download');
  });

  it('somente remoto → download', () => {
    expect(decideLastWriteWins(undefined, cad({ syncStatus: 'synced' })).action).toBe('download');
  });

  it('local synced sem remoto e não deletado → upload', () => {
    const local = cad({ syncStatus: 'synced' });
    expect(decideLastWriteWins(local, undefined).action).toBe('upload');
  });

  it('exclusão local synced sem tombstone remoto → upload', () => {
    const local = bumpRecordMeta(cad({ syncStatus: 'synced' }), 'dev-a', 'u1', 'DELETE');
    expect(decideLastWriteWins(local, undefined).action).toBe('upload');
  });

  it('local ativo × remoto excluído no mesmo updatedAt → download', () => {
    const local = cad({ updatedAt: 5000, syncVersion: 3 });
    const remote = cad({
      updatedAt: 5000,
      syncVersion: 3,
      deleted: true,
      deletedAt: 5000,
      syncStatus: 'synced',
    });
    expect(decideLastWriteWins(local, remote).action).toBe('download');
  });
});
