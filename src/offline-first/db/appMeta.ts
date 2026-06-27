import { getMeta, setMeta, getTafDatabase } from './tafDatabase';

/** Cache em memória — preenchido na hidratação do IndexedDB (Dexie meta). */
const cache = new Map<string, string>();

/** Chaves legadas em localStorage → chave no Dexie meta. */
const LEGACY_LOCAL_STORAGE_MAP: Record<string, string> = {
  'taf:lastDataOwnerUid': 'session:dataOwnerUid',
  'taf:lastLoginUid': 'session:loginUid',
  'taf:authProfile': 'auth:profile',
  'taf:deviceId': 'device:id',
  'taf:pendingSyncAfterAuth': 'sync:pendingResumeAt',
  'taf:syncResumeMessage': 'sync:resumeMessage',
};

export const APP_META_KEYS = [
  'session:dataOwnerUid',
  'session:loginUid',
  'auth:profile',
  'device:id',
  'sync:pendingResumeAt',
  'sync:resumeMessage',
] as const;

let appMetaHydrated = false;

export function readAppMetaCache(key: string): string | null {
  const value = cache.get(key);
  return value?.trim() || null;
}

export async function writeAppMeta(key: string, value: string): Promise<void> {
  cache.set(key, value);
  if (!getTafDatabase()) return;
  await setMeta(key, value);
}

export function writeAppMetaSync(key: string, value: string): void {
  cache.set(key, value);
  void writeAppMeta(key, value);
}

export async function removeAppMeta(key: string): Promise<void> {
  cache.delete(key);
  if (!getTafDatabase()) return;
  await setMeta(key, '');
}

export function removeAppMetaSync(key: string): void {
  cache.delete(key);
  void removeAppMeta(key);
}

/** Copia valores legados do localStorage para Dexie meta e remove do localStorage. */
export async function migrateLegacyLocalStorageToAppMeta(): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  for (const [legacyKey, metaKey] of Object.entries(LEGACY_LOCAL_STORAGE_MAP)) {
    if (readAppMetaCache(metaKey)) {
      try {
        localStorage.removeItem(legacyKey);
      } catch {
        // silencioso
      }
      continue;
    }

    try {
      const legacy = localStorage.getItem(legacyKey);
      if (!legacy?.trim()) continue;
      cache.set(metaKey, legacy);
      if (getTafDatabase()) {
        await setMeta(metaKey, legacy);
      }
      localStorage.removeItem(legacyKey);
    } catch {
      // quota / modo privado
    }
  }
}

export async function hydrateAppMetaFromIndexedDb(): Promise<void> {
  if (appMetaHydrated) return;
  appMetaHydrated = true;

  await migrateLegacyLocalStorageToAppMeta();

  const db = getTafDatabase();
  if (!db) return;

  for (const key of APP_META_KEYS) {
    if (cache.has(key)) continue;
    const value = await getMeta(key);
    if (value?.trim()) {
      cache.set(key, value);
    }
  }
}

/** Hidrata meta + sessão + perfil — ponto único na abertura do app. */
export async function hydrateAppStorageFromIndexedDb(): Promise<void> {
  await hydrateAppMetaFromIndexedDb();
  const { hydrateAuthProfileFromIndexedDb } = await import('../../services/firebase/authProfile');
  const { hydrateAuthUidFromIndexedDb } = await import('../../services/firebase/authUid');
  await hydrateAuthProfileFromIndexedDb();
  await hydrateAuthUidFromIndexedDb();
}

/** Reseta cache em memória — apenas testes. */
export function resetAppMetaCacheForTests(): void {
  cache.clear();
  appMetaHydrated = false;
}
