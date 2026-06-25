import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CadastroItemPersist } from './cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from './resultadosAplicadosIndexedDb';
import type { ResumoInicioTafHistorico } from '../utils/resultadoGeralHistorico';
import type { PendingOp, Tombstones } from './offline/pendingOps';
import { emptyTombstones } from './offline/pendingOps';

export type CloudDataCacheEntry = {
  uid: string;
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  resumo: ResumoInicioTafHistorico;
  syncedAt: number;
  pendingOps?: PendingOp[];
  tombstones?: Tombstones;
};

const ASYNC_KEY_PREFIX = 'taf_cloud_cache:';
const IDB_NAME = 'taf_cloud_cache_db';
const IDB_STORE = 'entries';
const IDB_VERSION = 1;

/** Tempo mínimo entre sincronizações completas com a nuvem. */
export const CLOUD_CACHE_TTL_MS = 10 * 60 * 1000;

let memory: CloudDataCacheEntry | null = null;

function cacheKey(uid: string): string {
  return `${ASYNC_KEY_PREFIX}${uid}`;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'uid' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readFromIdb(uid: string): Promise<CloudDataCacheEntry | null> {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(uid);
      req.onsuccess = () => resolve((req.result as CloudDataCacheEntry) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function writeToIdb(entry: CloudDataCacheEntry): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function readFromAsyncStorage(uid: string): Promise<CloudDataCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as CloudDataCacheEntry;
  } catch {
    return null;
  }
}

async function writeToAsyncStorage(entry: CloudDataCacheEntry): Promise<void> {
  await AsyncStorage.setItem(cacheKey(entry.uid), JSON.stringify(entry));
}

export function getMemoryCloudCache(uid: string): CloudDataCacheEntry | null {
  if (memory?.uid === uid) return memory;
  return null;
}

export function setMemoryCloudCache(entry: CloudDataCacheEntry): void {
  memory = entry;
}

export function clearMemoryCloudCache(): void {
  memory = null;
}

export function isCloudCacheFresh(entry: CloudDataCacheEntry): boolean {
  return Date.now() - entry.syncedAt < CLOUD_CACHE_TTL_MS;
}

/** Cache exibido sem esperar rede se tiver dados locais ou sync recente. */
export function isCloudCacheInstant(entry: CloudDataCacheEntry): boolean {
  const hasData = entry.cadastros.length > 0 || entry.sessoes.length > 0;
  const hasPending = (entry.pendingOps?.length ?? 0) > 0;
  return hasData && (isCloudCacheFresh(entry) || hasPending);
}

export function normalizeCloudCacheEntry(entry: CloudDataCacheEntry): CloudDataCacheEntry {
  return {
    ...entry,
    pendingOps: entry.pendingOps ?? [],
    tombstones: entry.tombstones ?? emptyTombstones(),
  };
}

export async function readCloudDataCache(uid: string): Promise<CloudDataCacheEntry | null> {
  const mem = getMemoryCloudCache(uid);
  if (mem) return mem;

  if (Platform.OS === 'web') {
    const fromIdb = await readFromIdb(uid);
    if (fromIdb) {
      const normalized = normalizeCloudCacheEntry(fromIdb);
      memory = normalized;
      return normalized;
    }
    return null;
  }

  const fromAsync = await readFromAsyncStorage(uid);
  if (fromAsync) {
    const normalized = normalizeCloudCacheEntry(fromAsync);
    memory = normalized;
    return normalized;
  }

  return null;
}

export async function writeCloudDataCache(entry: CloudDataCacheEntry): Promise<void> {
  memory = entry;

  try {
    if (Platform.OS === 'web') {
      await writeToIdb(entry);
    } else {
      await writeToAsyncStorage(entry);
    }
  } catch {
    // Mantém em memória nesta sessão mesmo se persistência falhar (Safari).
  }
}

export async function clearCloudDataCache(uid: string): Promise<void> {
  if (memory?.uid === uid) memory = null;
  try {
    if (Platform.OS === 'web' && typeof indexedDB !== 'undefined') {
      const db = await openIdb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const req = tx.objectStore(IDB_STORE).delete(uid);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    // silencioso
  }
  try {
    await AsyncStorage.removeItem(cacheKey(uid));
  } catch {
    // silencioso
  }
}

/** Zera cache local/nuvem offline sem apagar Firestore remoto. */
export async function resetCloudDataCache(
  uid: string,
  resumo: CloudDataCacheEntry['resumo'],
): Promise<void> {
  const entry: CloudDataCacheEntry = {
    uid,
    cadastros: [],
    sessoes: [],
    resumo,
    syncedAt: Date.now(),
    pendingOps: [],
    tombstones: emptyTombstones(),
  };
  memory = entry;

  try {
    if (Platform.OS === 'web' && typeof indexedDB !== 'undefined') {
      await writeToIdb(entry);
    } else {
      await writeToAsyncStorage(entry);
    }
  } catch {
    // Mantém em memória nesta sessão.
  }
}
