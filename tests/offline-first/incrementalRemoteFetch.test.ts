import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/supabase/cadastrosCloud', () => ({
  getAllCadastrosFirestoreLight: vi.fn(async () => []),
  getCadastrosFirestoreSince: vi.fn(async () => []),
}));
vi.mock('../../src/services/supabase/sessoesCloud', () => ({
  getAllSessoesFirestoreLight: vi.fn(async () => []),
  getSessoesFirestoreSince: vi.fn(async () => []),
}));
vi.mock('../../src/services/supabase/aplicadoresCloud', () => ({
  getAllAplicadoresFirestore: vi.fn(async () => []),
  getAplicadoresFirestoreSince: vi.fn(async () => []),
}));
vi.mock('../../src/services/supabase/cloudTombstonesForSync', () => ({
  listCadastrosTombstonesForSync: vi.fn(async () => []),
  listCadastrosTombstonesSinceForSync: vi.fn(async () => []),
  listSessoesTombstonesForSync: vi.fn(async () => []),
  listSessoesTombstonesSinceForSync: vi.fn(async () => []),
  listAplicadoresTombstonesForSync: vi.fn(async () => []),
  listAplicadoresTombstonesSinceForSync: vi.fn(async () => []),
}));

import {
  getAllCadastrosFirestoreLight,
  getCadastrosFirestoreSince,
} from '../../src/services/supabase/cadastrosCloud';
import { listCadastrosTombstonesSinceForSync } from '../../src/services/supabase/cloudTombstonesForSync';
import {
  fetchRemoteCollectionsSnapshot,
  invalidateRemoteSnapshotCache,
} from '../../src/offline-first/sync/remoteSnapshotCache';
import {
  isFullFetchDue,
  markFullFetchDone,
  setRemoteSyncWatermark,
} from '../../src/offline-first/sync/syncWatermark';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { putCadastroRecord } from '../../src/offline-first/db/localDb';
import type { CadastroRecord } from '../../src/offline-first/types';

const OWNER = 'owner-incremental-1';

function syncedCadastro(id: string, nome: string): CadastroRecord {
  return {
    id,
    nip: `77${id.replace(/\D/g, '').padStart(6, '0')}`,
    nome,
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: OWNER,
    createdAt: 1_000,
    updatedAt: 1_000,
    version: 2,
    syncVersion: 2,
    deviceId: 'device-a',
    userId: null,
    syncStatus: 'synced',
    deleted: false,
    lastModifiedBy: 'device-a',
  } as CadastroRecord;
}

describe('fetch remoto incremental — não baixar tudo a cada sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateRemoteSnapshotCache();
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await closeTafDatabaseForTests();
  });

  it('sem watermark: full fetch é usado (markFullFetchDone só após LWW íntegro)', async () => {
    const snapshot = await fetchRemoteCollectionsSnapshot('owner-sem-watermark', true);
    expect(snapshot.fetchMode).toBe('full');
    expect(getAllCadastrosFirestoreLight).toHaveBeenCalled();
    expect(getCadastrosFirestoreSince).not.toHaveBeenCalled();
    // Full fetch NÃO marca done no download — SyncManager faz após sucesso.
    expect(await isFullFetchDue('owner-sem-watermark')).toBe(true);
  });

  it('com watermark: força só invalida cache, fetch continua incremental', async () => {
    await putCadastroRecord(syncedCadastro('inc-1', 'Já Sincronizado'));
    await setRemoteSyncWatermark(OWNER, Date.now() - 60_000);
    await markFullFetchDone(OWNER);

    (getCadastrosFirestoreSince as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'inc-2', nip: '7700000099', nome: 'Novo Na Nuvem', updatedAt: Date.now() },
    ]);

    const snapshot = await fetchRemoteCollectionsSnapshot(OWNER, true);

    expect(snapshot.fetchMode).toBe('incremental');
    expect(getAllCadastrosFirestoreLight).not.toHaveBeenCalled();
    expect(getCadastrosFirestoreSince).toHaveBeenCalled();
    // Baseline local + delta remoto
    const ids = snapshot.remoteCad.map((r) => r.id);
    expect(ids).toContain('inc-1');
    expect(ids).toContain('inc-2');
  });

  it('tombstone no delta remove o registro do baseline ativo', async () => {
    await putCadastroRecord(syncedCadastro('inc-del', 'Vai Ser Excluído'));
    await setRemoteSyncWatermark(OWNER, Date.now() - 60_000);
    await markFullFetchDone(OWNER);

    (listCadastrosTombstonesSinceForSync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'inc-del', updatedAt: Date.now(), deleted: true, deletedAt: Date.now() },
    ]);

    const snapshot = await fetchRemoteCollectionsSnapshot(OWNER, true);

    expect(snapshot.remoteCad.some((r) => r.id === 'inc-del')).toBe(false);
    expect(snapshot.remoteCadTombstones.some((t) => t.id === 'inc-del')).toBe(true);
  });
});
