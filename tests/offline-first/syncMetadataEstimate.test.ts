import { describe, expect, it } from 'vitest';
import {
  countCadastroMilitarDownloads,
  countMetadataDownloads,
} from '../../src/offline-first/sync/syncMetadataEstimate';

describe('estimativa de sync por metadados', () => {
  it('baixa só o que é novo ou mais recente na nuvem', () => {
    const local = new Map([
      ['igual', { id: 'igual', updatedAt: 10, deleted: false, unsynced: false }],
      ['local-novo', { id: 'local-novo', updatedAt: 20, deleted: false, unsynced: true }],
      ['nuvem-nova', { id: 'nuvem-nova', updatedAt: 5, deleted: false, unsynced: false }],
    ]);

    const downloads = countMetadataDownloads(local, [
      { id: 'igual', owner_uid: 'o', updated_at: 10, deleted: false },
      { id: 'local-novo', owner_uid: 'o', updated_at: 15, deleted: false },
      { id: 'nuvem-nova', owner_uid: 'o', updated_at: 30, deleted: false },
      { id: 'so-nuvem', owner_uid: 'o', updated_at: 8, deleted: false },
      { id: 'tombstone-sem-local', owner_uid: 'o', updated_at: 9, deleted: true },
    ]);

    expect(downloads).toBe(2);
  });

  it('cadastro conta militares na nuvem que o aparelho não tem ou que estão mais novos', () => {
    const local = new Map([
      ['ja-aqui', { id: 'ja-aqui', updatedAt: 0, deleted: false, unsynced: false }],
      ['ficha-velha', { id: 'ficha-velha', updatedAt: 10, deleted: false, unsynced: false }],
      ['excluido-aqui', { id: 'excluido-aqui', updatedAt: 40, deleted: true, unsynced: true }],
    ]);

    const downloads = countCadastroMilitarDownloads(local, [
      { id: 'ja-aqui', owner_uid: 'o', updated_at: 99, deleted: false },
      { id: 'ficha-velha', owner_uid: 'o', updated_at: 30, deleted: false },
      { id: 'excluido-aqui', owner_uid: 'o', updated_at: 50, deleted: false },
      { id: 'so-nuvem', owner_uid: 'o', updated_at: 8, deleted: false },
      { id: 'apagado-nuvem', owner_uid: 'o', updated_at: 12, deleted: true },
    ]);

    expect(downloads).toBe(2);
  });
});
