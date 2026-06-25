import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import {
  readCloudDataCache,
  writeCloudDataCache,
  isCloudCacheInstant,
  getMemoryCloudCache,
  setMemoryCloudCache,
  type CloudDataCacheEntry,
} from '../cloudDataCache';
import { calcularResumoInicioTafFromHistorico } from '../../utils/resultadoGeralHistorico';
import { waitForAuthenticatedUid } from './authUid';
import { isOnline } from '../offline/networkStatus';
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

  const online = isOnline();

  const cached =
    !options?.forceRefresh
      ? getMemoryCloudCache(uid) ?? (await readCloudDataCache(uid))
      : null;

  const showCached = (entry: CloudDataCacheEntry, syncing: boolean) => {
    onProgress({
      percent: 100,
      loading: syncing,
      loadedCadastros: entry.cadastros.length,
      loadedSessoes: entry.sessoes.length,
      fromCache: true,
      offline: !online,
      pendingSync: entry.pendingOps?.length ?? 0,
    });
  };

  if (cached && (isCloudCacheInstant(cached) || !online)) {
    setMemoryCloudCache(cached);
    showCached(cached, online);
    if (online) {
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
      } catch {
        showCached(cached, false);
        return cached;
      }
    }
    return cached;
  }

  const cachedVazio =
    cached == null || (cached.cadastros.length === 0 && cached.sessoes.length === 0);

  if (cached && cached.cadastros.length > 0) {
    showCached(cached, online);
  } else {
    onProgress({
      percent: online ? 8 : 100,
      loading: online,
      loadedCadastros: 0,
      loadedSessoes: 0,
      fromCache: false,
      offline: !online,
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

  const cachedBeforeSync = getMemoryCloudCache(uid) ?? (await readCloudDataCache(uid));
  const pendingBeforeSync = cachedBeforeSync?.pendingOps?.length ?? 0;
  const localVazio =
    !cachedBeforeSync ||
    (cachedBeforeSync.cadastros.length === 0 && cachedBeforeSync.sessoes.length === 0);

  if (pendingBeforeSync > 0 && !localVazio) {
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: entry.cadastros.length,
      loadedSessoes: entry.sessoes.length,
      fromCache: true,
      offline: false,
      pendingSync: pendingBeforeSync,
    });
    void syncOfflineCloudData(uid).catch(() => undefined);
    return entry;
  }

  if (cachedVazio && online) {
    try {
      const entry = await readOfflineCloudEntry(uid, { forcePull: true });
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
        showCached(cached, false);
        return cached;
      }
      throw error;
    }
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
      showCached(cached, false);
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
