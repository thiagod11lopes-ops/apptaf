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
import {
  readOfflineCloudEntry,
  syncOfflineCloudData,
} from '../offline/offlineCloudEngine';

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

export async function syncCloudDataCache(uid: string): Promise<CloudDataCacheEntry> {
  return syncOfflineCloudData(uid);
}

export async function loadHomeCloudData(
  onProgress: (state: CloudDataLoadState) => void,
  options?: { forceRefresh?: boolean },
): Promise<CloudDataCacheEntry | null> {
  const uid = await waitForAuthenticatedUid();
  if (!uid) return null;

  const online = canAttemptCloudSync();

  const cached =
    !options?.forceRefresh
      ? getMemoryCloudCache(uid) ?? (await readCloudDataCache(uid))
      : null;

  if (cached && (cached.cadastros.length > 0 || cached.sessoes.length > 0)) {
    onProgress({
      percent: 100,
      loading: online,
      loadedCadastros: cached.cadastros.length,
      loadedSessoes: cached.sessoes.length,
      fromCache: true,
      offline: !online,
      pendingSync: cached.pendingOps?.length ?? 0,
    });
  } else if (!online) {
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: 0,
      loadedSessoes: 0,
      fromCache: true,
      offline: true,
    });
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

  if (!online) {
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: entry.cadastros.length,
      loadedSessoes: entry.sessoes.length,
      fromCache: true,
      offline: true,
      pendingSync: entry.pendingOps?.length ?? 0,
    });
    return entry;
  }

  try {
    const entry = await syncOfflineCloudData(uid);
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: entry.cadastros.length,
      loadedSessoes: entry.sessoes.length,
      fromCache: false,
      offline: false,
      pendingSync: entry.pendingOps?.length ?? 0,
    });
    return entry;
  } catch (error) {
    if (cached) {
      onProgress({
        percent: 100,
        loading: false,
        loadedCadastros: cached.cadastros.length,
        loadedSessoes: cached.sessoes.length,
        fromCache: true,
        offline: false,
        pendingSync: cached.pendingOps?.length ?? 0,
      });
      return cached;
    }
    throw error;
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
