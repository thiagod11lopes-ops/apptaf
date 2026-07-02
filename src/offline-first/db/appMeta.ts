import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMeta, setMeta, getTafDatabase } from './tafDatabase';

/** Cache em memória — preenchido na hidratação do IndexedDB (Dexie meta). */
const cache = new Map<string, string>();

export const THEME_META_KEY = 'ui:themeMode';
export const PRE_CADASTRO_META_PREFIX = 'preCadastro:';

const LEGACY_PRE_CADASTRO_PREFIX = 'taf_pre_cadastros:';
const ASYNC_META_PREFIX = '@taf-meta:';

/** Chaves legadas em localStorage → chave no Dexie meta. */
const LEGACY_LOCAL_STORAGE_MAP: Record<string, string> = {
  'taf:lastDataOwnerUid': 'session:dataOwnerUid',
  'taf:lastLoginUid': 'session:loginUid',
  'taf:authProfile': 'auth:profile',
  'taf:deviceId': 'device:id',
  'taf:pendingSyncAfterAuth': 'sync:pendingResumeAt',
  'taf:syncResumeMessage': 'sync:resumeMessage',
  'taf-theme-mode': THEME_META_KEY,
};

export const APP_META_KEYS = [
  'session:dataOwnerUid',
  'session:loginUid',
  'auth:profile',
  'device:id',
  'sync:pendingResumeAt',
  'sync:resumeMessage',
  THEME_META_KEY,
  'demo:modoAtivo',
  'demo:backupId',
] as const;

export const DEMO_MODO_ATIVO_KEY = 'demo:modoAtivo';
export const DEMO_BACKUP_ID_KEY = 'demo:backupId';

export function isModoDemonstracaoAtivo(): boolean {
  return readAppMetaCache(DEMO_MODO_ATIVO_KEY) === '1';
}

let appMetaHydrated = false;

function usesIndexedDbMeta(): boolean {
  return getTafDatabase() != null;
}

function asyncMetaKey(key: string): string {
  return `${ASYNC_META_PREFIX}${key}`;
}

export function readAppMetaCache(key: string): string | null {
  const value = cache.get(key);
  return value?.trim() || null;
}

export async function readAppMeta(key: string): Promise<string | null> {
  const cached = readAppMetaCache(key);
  if (cached) return cached;

  if (usesIndexedDbMeta()) {
    const value = await getMeta(key);
    if (value?.trim()) {
      cache.set(key, value);
      return value.trim();
    }
    return null;
  }

  try {
    const value = await AsyncStorage.getItem(asyncMetaKey(key));
    if (value?.trim()) {
      cache.set(key, value);
      return value.trim();
    }
  } catch {
    // silencioso
  }
  return null;
}

async function persistMetaValue(key: string, value: string): Promise<void> {
  cache.set(key, value);
  if (usesIndexedDbMeta()) {
    await setMeta(key, value);
    return;
  }
  try {
    await AsyncStorage.setItem(asyncMetaKey(key), value);
  } catch {
    // silencioso
  }
}

export async function writeAppMeta(key: string, value: string): Promise<void> {
  await persistMetaValue(key, value);
}

export function writeAppMetaSync(key: string, value: string): void {
  cache.set(key, value);
  void persistMetaValue(key, value);
}

export async function removeAppMeta(key: string): Promise<void> {
  cache.delete(key);
  if (usesIndexedDbMeta()) {
    await setMeta(key, '');
    return;
  }
  try {
    await AsyncStorage.removeItem(asyncMetaKey(key));
  } catch {
    // silencioso
  }
}

export function removeAppMetaSync(key: string): void {
  cache.delete(key);
  void removeAppMeta(key);
}

export function preCadastroMetaKey(ownerKey: string): string {
  return `${PRE_CADASTRO_META_PREFIX}${ownerKey}`;
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
      if (usesIndexedDbMeta()) {
        await setMeta(metaKey, legacy);
      }
      localStorage.removeItem(legacyKey);
    } catch {
      // quota / modo privado
    }
  }

  for (let i = 0; i < localStorage.length; i += 1) {
    const legacyKey = localStorage.key(i);
    if (!legacyKey?.startsWith(LEGACY_PRE_CADASTRO_PREFIX)) continue;

    const ownerKey = legacyKey.slice(LEGACY_PRE_CADASTRO_PREFIX.length);
    const metaKey = preCadastroMetaKey(ownerKey);
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
      if (usesIndexedDbMeta()) {
        await setMeta(metaKey, legacy);
      }
      localStorage.removeItem(legacyKey);
    } catch {
      // silencioso
    }
  }
}

/** Migra tema e pré-cadastros legados do AsyncStorage (app nativo / Expo web antigo). */
export async function migrateLegacyAsyncStorageToAppMeta(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    for (const legacyKey of keys) {
      if (legacyKey === 'taf-theme-mode') {
        const metaKey = THEME_META_KEY;
        if (!readAppMetaCache(metaKey)) {
          const legacy = await AsyncStorage.getItem(legacyKey);
          if (legacy === 'light' || legacy === 'dark') {
            await persistMetaValue(metaKey, legacy);
          }
        }
        await AsyncStorage.removeItem(legacyKey);
        continue;
      }

      if (!legacyKey.startsWith(LEGACY_PRE_CADASTRO_PREFIX)) continue;

      const ownerKey = legacyKey.slice(LEGACY_PRE_CADASTRO_PREFIX.length);
      const metaKey = preCadastroMetaKey(ownerKey);
      if (!readAppMetaCache(metaKey)) {
        const legacy = await AsyncStorage.getItem(legacyKey);
        if (legacy?.trim()) {
          await persistMetaValue(metaKey, legacy);
        }
      }
      await AsyncStorage.removeItem(legacyKey);
    }
  } catch {
    // silencioso
  }
}

export async function hydrateAppMetaFromIndexedDb(): Promise<void> {
  if (appMetaHydrated) return;
  appMetaHydrated = true;

  await migrateLegacyLocalStorageToAppMeta();
  await migrateLegacyAsyncStorageToAppMeta();

  if (!usesIndexedDbMeta()) return;

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
  const { garantirModoNormalNaAbertura } = await import('../../services/modoDemonstracao');
  await garantirModoNormalNaAbertura();
}

/** Reseta cache em memória — apenas testes. */
export function resetAppMetaCacheForTests(): void {
  cache.clear();
  appMetaHydrated = false;
}
