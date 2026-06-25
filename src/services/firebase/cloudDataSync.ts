import type { CloudDataCacheEntry } from '../cloudDataCache';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { dataStore } from '../offline-first/store/DataStore';
import { waitForAuthenticatedUid } from './authUid';
import { canAttemptCloudSync } from '../offline/networkStatus';
import { getCloudActivityState, subscribeCloudActivity } from '../offline/cloudSyncActivity';
import { syncEngine } from '../offline-first/sync/SyncEngine';

export type CloudDataLoadState = {
  percent: number;
  loading: boolean;
  loadedCadastros: number;
  loadedSessoes: number;
  fromCache: boolean;
  offline?: boolean;
  pendingSync?: number;
};

export async function loadHomeCloudData(
  onProgress: (state: CloudDataLoadState) => void,
  options?: { forceRefresh?: boolean },
): Promise<CloudDataCacheEntry | null> {
  const uid = await waitForAuthenticatedUid();
  if (!uid) return null;

  const online = canAttemptCloudSync();
  const useDexie = getTafDatabase() != null;

  const reportFromStore = async (loading: boolean, fromCache: boolean) => {
    const cadastros = await dataStore.getCadastros(uid);
    const sessoes = await dataStore.getSessoes(uid);
    const resumo = await dataStore.getResumo(uid);
    onProgress({
      percent: loading ? getCloudActivityState().syncProgress || 15 : 100,
      loading,
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
    const entry = await readOfflineCloudEntry(uid, { autoSync: online, forcePull: options?.forceRefresh });
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

  await reportFromStore(online, true);

  const unsub = subscribeCloudActivity((state) => {
    if (!state.syncing) return;
    void reportFromStore(true, true);
  });

  try {
    if (online && options?.forceRefresh) {
      await syncEngine.forceSync();
    } else if (online) {
      await syncEngine.scheduleProcess(true);
    }
    return await reportFromStore(false, false);
  } finally {
    unsub();
  }
}
