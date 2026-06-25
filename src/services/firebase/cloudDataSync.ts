import type { CloudDataCacheEntry } from '../cloudDataCache';
import { getTafDatabase } from '../../offline-first/db/tafDatabase';
import { dataStore } from '../../offline-first/store/DataStore';
import { resolveStorageOwnerUid } from './authUid';
import { canAttemptCloudSync } from '../offline/networkStatus';
import { syncEngine } from '../../offline-first/sync/SyncEngine';

export type CloudDataLoadState = {
  percent: number;
  loading: boolean;
  loadedCadastros: number;
  loadedSessoes: number;
  fromCache: boolean;
  offline?: boolean;
  pendingSync?: number;
};

/** Lê resumo da Home a partir do Dexie local (sem disparar sync em loop). */
export async function loadHomeCloudData(
  onProgress: (state: CloudDataLoadState) => void,
  options?: { forceRefresh?: boolean },
): Promise<CloudDataCacheEntry | null> {
  const uid = await resolveStorageOwnerUid();
  if (!uid) return null;

  const online = canAttemptCloudSync();
  const useDexie = getTafDatabase() != null;

  const reportFromStore = async (fromCache: boolean) => {
    const cadastros = await dataStore.getCadastros(uid);
    const sessoes = await dataStore.getSessoes(uid);
    const resumo = await dataStore.getResumo(uid);
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: cadastros.length,
      loadedSessoes: sessoes.length,
      fromCache,
      offline: !online,
      pendingSync: await dataStore.pendingCount(uid),
    });
    return {
      uid,
      cadastros,
      sessoes,
      resumo,
      syncedAt: Date.now(),
      pendingOps: [],
      tombstones: { cadastros: {}, sessoes: {} },
    } satisfies CloudDataCacheEntry;
  };

  if (!useDexie) {
    const { readOfflineCloudEntry } = await import('../offline/offlineCloudEngine');
    const entry = await readOfflineCloudEntry(uid, {
      autoSync: online && !!options?.forceRefresh,
      forcePull: options?.forceRefresh,
    });
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: entry.cadastros.length,
      loadedSessoes: entry.sessoes.length,
      fromCache: false,
      offline: !online,
      pendingSync: entry.pendingOps?.length ?? 0,
    });
    return entry;
  }

  if (online && options?.forceRefresh) {
    onProgress({
      percent: 15,
      loading: true,
      loadedCadastros: 0,
      loadedSessoes: 0,
      fromCache: true,
      offline: false,
    });
    await syncEngine.forceSync();
  }

  return reportFromStore(!options?.forceRefresh);
}
