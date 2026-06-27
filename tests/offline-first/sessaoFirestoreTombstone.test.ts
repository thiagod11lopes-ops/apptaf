import { describe, expect, it } from 'vitest';
import { decideLastWriteWins } from '../../src/offline-first/sync/lastWriteWins';
import { remoteDocToSyncRecord } from '../../src/offline-first/sync/tombstone';
import { toSessaoFromFirestoreDoc } from '../../src/utils/sessaoLight';

describe('toSessaoFromFirestoreDoc', () => {
  it('preserva tombstone deleted ao ler doc light do Firestore', () => {
    const row = toSessaoFromFirestoreDoc({
      id: 'sessao-1',
      updatedAt: 9000,
      deleted: true,
      deletedAt: 9000,
      syncVersion: 4,
    });
    expect(row.deleted).toBe(true);
    expect(row.updatedAt).toBe(9000);

    const sync = remoteDocToSyncRecord(row, 'boss');
    expect(
      decideLastWriteWins(
        { id: 'sessao-1', updatedAt: 2000, deleted: false, ownerUid: 'boss' } as never,
        sync,
      ).action,
    ).toBe('download');
  });
});
