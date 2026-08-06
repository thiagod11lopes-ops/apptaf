import { beforeEach, describe, expect, it, vi } from 'vitest';

const ownerRef = { current: 'owner-a' as string | null };

vi.mock('../../src/services/firebase/authUid', () => ({
  getCachedDataOwnerUid: () => ownerRef.current,
}));

vi.mock('../../src/offline-first/sync/SyncEngine', () => ({
  subscribeDataChanged: () => () => {},
}));

import {
  clearCadastrosListCache,
  getCadastrosListCached,
  invalidateCadastrosListCache,
  isCadastrosListCacheWarm,
  peekCadastrosListCache,
} from '../../src/services/cadastrosListCache';

describe('cadastrosListCache soft invalidate', () => {
  beforeEach(() => {
    ownerRef.current = 'owner-a';
    clearCadastrosListCache();
  });

  it('mantém peek após soft-invalidate', async () => {
    const fetch = vi.fn(async () => [
      {
        id: 'c1',
        nip: '12.3456.78',
        nome: 'A',
        dataNascimento: '01/01/1990',
        categoria: 'Praças' as const,
      },
    ]);
    await getCadastrosListCached(null, {}, fetch);
    expect(isCadastrosListCacheWarm()).toBe(true);

    invalidateCadastrosListCache();
    expect(isCadastrosListCacheWarm()).toBe(false);
    expect(peekCadastrosListCache()?.[0]?.id).toBe('c1');
  });
});
