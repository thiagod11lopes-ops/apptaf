import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CadastroItemPersist } from './cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from './resultadosAplicadosIndexedDb';
import type { ResumoInicioTafHistorico } from '../utils/resultadoGeralHistorico';

export type CloudDataCacheEntry = {
  uid: string;
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  resumo: ResumoInicioTafHistorico;
  syncedAt: number;
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
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // fallback silencioso
  }
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
  try {
    await AsyncStorage.setItem(cacheKey(entry.uid), JSON.stringify(entry));
  } catch {
    // silencioso
  }
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

export async function readCloudDataCache(uid: string): Promise<CloudDataCacheEntry | null> {
  const mem = getMemoryCloudCache(uid);
  if (mem) return mem;

  const fromIdb = Platform.OS === 'web' ? await readFromIdb(uid) : null;
  if (fromIdb) {
    memory = fromIdb;
    return fromIdb;
  }

  const fromAsync = await readFromAsyncStorage(uid);
  if (fromAsync) {
    memory = fromAsync;
    return fromAsync;
  }

  return null;
}

export async function writeCloudDataCache(entry: CloudDataCacheEntry): Promise<void> {
  memory = entry;
  if (Platform.OS === 'web') {
    await writeToIdb(entry);
  }
  await writeToAsyncStorage(entry);
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
