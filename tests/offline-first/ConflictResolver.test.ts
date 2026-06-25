import { describe, expect, it } from 'vitest';
import { resolveRecordConflict, bumpRecordMeta } from '../../src/offline-first/sync/ConflictResolver';
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
    version: 1,
    deviceId: 'd1',
    userId: 'u1',
    syncStatus: 'pending',
    deleted: false,
    lastModifiedBy: 'd1',
    ...partial,
  };
}

describe('ConflictResolver', () => {
  it('prefere version maior', () => {
    const local = cad({ version: 3, updatedAt: 2000, nome: 'Local' });
    const remote = cad({ version: 2, updatedAt: 9000, nome: 'Remoto' });
    const r = resolveRecordConflict(local, remote);
    expect(r.winner).toBe('local');
    expect(r.record.nome).toBe('Local');
  });

  it('prefere updatedAt quando version igual', () => {
    const local = cad({ version: 2, updatedAt: 5000, nome: 'Local' });
    const remote = cad({ version: 2, updatedAt: 3000, nome: 'Remoto' });
    const r = resolveRecordConflict(local, remote);
    expect(r.winner).toBe('local');
  });

  it('soft delete mais recente prevalece', () => {
    const local = bumpRecordMeta(cad({ updatedAt: 8000 }), 'dev-a', 'u1', 'DELETE');
    const remote = cad({ updatedAt: 4000, nome: 'Ativo' });
    const r = resolveRecordConflict(local, remote);
    expect(r.record.deleted).toBe(true);
  });
});
