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
import { getAllCadastrosFirestoreLight } from './cadastrosFirestore';
import { getAllSessoesFirestoreLight } from './sessoesFirestore';

export type CloudDataLoadState = {
  percent: number;
  loading: boolean;
  loadedCadastros: number;
  loadedSessoes: number;
  fromCache: boolean;
};

async function fetchLightFromCloud(uid: string): Promise<{
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
}> {
  const [cadastros, sessoes] = await Promise.all([
    getAllCadastrosFirestoreLight(uid),
    getAllSessoesFirestoreLight(uid),
  ]);
  return { cadastros, sessoes };
}

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
  };
}

export async function syncCloudDataCache(uid: string): Promise<CloudDataCacheEntry> {
  const { cadastros, sessoes } = await fetchLightFromCloud(uid);
  const entry = buildCacheEntry(uid, cadastros, sessoes);
  setMemoryCloudCache(entry);
  await writeCloudDataCache(entry);
  return entry;
}

export async function loadHomeCloudData(
  onProgress: (state: CloudDataLoadState) => void,
  options?: { forceRefresh?: boolean },
): Promise<CloudDataCacheEntry | null> {
  const uid = await waitForAuthenticatedUid();
  if (!uid) return null;

  const cached =
    !options?.forceRefresh
      ? getMemoryCloudCache(uid) ?? (await readCloudDataCache(uid))
      : null;

  if (cached && isCloudCacheInstant(cached)) {
    setMemoryCloudCache(cached);
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: cached.cadastros.length,
      loadedSessoes: cached.sessoes.length,
      fromCache: true,
    });
    return cached;
  }

  if (cached && cached.cadastros.length > 0) {
    onProgress({
      percent: 100,
      loading: true,
      loadedCadastros: cached.cadastros.length,
      loadedSessoes: cached.sessoes.length,
      fromCache: true,
    });
  } else {
    onProgress({
      percent: 8,
      loading: true,
      loadedCadastros: 0,
      loadedSessoes: 0,
      fromCache: false,
    });
  }

  try {
    const entry = await syncCloudDataCache(uid);
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: entry.cadastros.length,
      loadedSessoes: entry.sessoes.length,
      fromCache: false,
    });
    return entry;
  } catch (error) {
    if (cached && cached.cadastros.length > 0) {
      onProgress({
        percent: 100,
        loading: false,
        loadedCadastros: cached.cadastros.length,
        loadedSessoes: cached.sessoes.length,
        fromCache: true,
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
