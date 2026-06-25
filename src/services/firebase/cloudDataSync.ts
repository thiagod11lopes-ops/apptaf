import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import {
  readCloudDataCache,
  getMemoryCloudCache,
  setMemoryCloudCache,
  type CloudDataCacheEntry,
} from '../cloudDataCache';
import { calcularResumoInicioTafFromHistorico } from '../../utils/resultadoGeralHistorico';
import { waitForAuthenticatedUid } from './authUid';
import { canAttemptCloudSync } from '../offline/networkStatus';
import { getCloudActivityState, subscribeCloudActivity } from '../offline/cloudSyncActivity';
import { readOfflineCloudEntry } from '../offline/offlineCloudEngine';

export type CloudDataLoadState = {
  percent: number;
  loading: boolean;
  loadedCadastros: number;
  loadedSessoes: number;
  fromCache: boolean;
  offline?: boolean;
  pendingSync?: number;
};

function buildCacheEntry(
  uid: string,
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
): CloudDataCacheEntry {
  return {
    uid,
    cadastros,
    sessoes,
    resumo: calcularResumoInicioTafFromHistorico(sessoes, cadastros),
    syncedAt: Date.now(),
    pendingOps: [],
    tombstones: { cadastros: {}, sessoes: {} },
  };
}

export async function loadHomeCloudData(
  onProgress: (state: CloudDataLoadState) => void,
  options?: { forceRefresh?: boolean },
): Promise<CloudDataCacheEntry | null> {
  const uid = await waitForAuthenticatedUid();
  if (!uid) return null;

  const online = canAttemptCloudSync();
  const forceRefresh = options?.forceRefresh === true;

  const cached =
    !forceRefresh
      ? getMemoryCloudCache(uid) ?? (await readCloudDataCache(uid))
      : null;

  const report = (entry: CloudDataCacheEntry, loading: boolean, fromCache: boolean) => {
    onProgress({
      percent: loading ? getCloudActivityState().syncProgress || 12 : 100,
      loading,
      loadedCadastros: entry.cadastros.length,
      loadedSessoes: entry.sessoes.length,
      fromCache,
      offline: !online,
      pendingSync: entry.pendingOps?.length ?? 0,
    });
  };

  if (!online) {
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    report(entry, false, true);
    return entry;
  }

  if (cached && (cached.cadastros.length > 0 || cached.sessoes.length > 0)) {
    setMemoryCloudCache(cached);
    report(cached, true, true);
  } else {
    onProgress({
      percent: 8,
      loading: true,
      loadedCadastros: 0,
      loadedSessoes: 0,
      fromCache: false,
      offline: false,
    });
  }

  const unsubProgress = subscribeCloudActivity((state) => {
    if (!state.syncing) return;
    const current = getMemoryCloudCache(uid) ?? cached;
    onProgress({
      percent: Math.max(state.syncProgress, 12),
      loading: true,
      loadedCadastros: current?.cadastros.length ?? 0,
      loadedSessoes: current?.sessoes.length ?? 0,
      fromCache: true,
      offline: false,
      pendingSync: current?.pendingOps?.length ?? 0,
    });
  });

  try {
    const entry = await readOfflineCloudEntry(uid, {
      autoSync: true,
      forcePull: forceRefresh,
    });
    report(entry, false, false);
    return entry;
  } catch (error) {
    if (cached) {
      report(cached, false, true);
      return cached;
    }
    throw error;
  } finally {
    unsubProgress();
  }
}

export function getCachedCadastros(uid: string): CadastroItemPersist[] | null {
  const mem = getMemoryCloudCache(uid);
  return mem?.cadastros ?? null;
}

export function getCachedSessoes(uid: string): SessaoAplicacaoTaf[] | null {
  const mem = getMemoryCloudCache(uid);
  return mem?.sessoes ?? null;
}

export { buildCacheEntry };
