import { getTafDatabase } from '../../offline-first/db/tafDatabase';
import {
  readAppMetaCache,
  removeAppMetaSync,
  writeAppMetaSync,
} from '../../offline-first/db/appMeta';
import { isCloudOwnerUid } from '../../utils/cloudOwnerUid';

const META_DATA_OWNER_KEY = 'session:dataOwnerUid';
const META_LOGIN_UID_KEY = 'session:loginUid';
const LOCAL_OWNER_PLACEHOLDER = '__local__';

/**
 * UID do login Firebase e UID dono dos dados (chefe quando membro autorizado).
 */
let authReady = false;
let loginUid: string | null = null;
let dataOwnerUid: string | null = null;
const waiters = new Set<(ownerUid: string | null) => void>();
/** Evita re-migrar owners legados a cada getAllCadastros (caro com milhares de linhas). */
let legacyOwnerMigrationDoneFor: string | null = null;

function readPersistedDataOwnerUid(): string | null {
  return readAppMetaCache(META_DATA_OWNER_KEY);
}

function persistDataOwnerUid(uid: string): void {
  writeAppMetaSync(META_DATA_OWNER_KEY, uid);
}

function clearPersistedDataOwnerUid(): void {
  removeAppMetaSync(META_DATA_OWNER_KEY);
}

function persistLoginUid(uid: string): void {
  writeAppMetaSync(META_LOGIN_UID_KEY, uid);
}

function readPersistedLoginUid(): string | null {
  return readAppMetaCache(META_LOGIN_UID_KEY);
}

function clearPersistedLoginUid(): void {
  removeAppMetaSync(META_LOGIN_UID_KEY);
}

function notifyWaiters() {
  for (const waiter of waiters) {
    waiter(dataOwnerUid);
  }
}

/** Infere o ownerUid dominante a partir dos registros no Dexie. */
async function inferPrimaryOwnerUidFromIndexedDb(): Promise<string | null> {
  const db = getTafDatabase();
  if (!db) return null;

  const counts = new Map<string, number>();
  const bump = (uid: string | undefined) => {
    if (!uid?.trim() || uid === LOCAL_OWNER_PLACEHOLDER) return;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  };

  try {
    const [cadastros, sessoes, aplicadores] = await Promise.all([
      db.cadastros.toArray(),
      db.sessoes.toArray(),
      db.aplicadores.toArray(),
    ]);
    for (const row of cadastros) bump(row.ownerUid);
    for (const row of sessoes) bump(row.ownerUid);
    for (const row of aplicadores) bump(row.ownerUid);
  } catch {
    return null;
  }

  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

let indexedDbSessionHydrated = false;

/** Restaura owner/login do IndexedDB (Dexie meta). */
export async function hydrateAuthUidFromIndexedDb(): Promise<void> {
  if (indexedDbSessionHydrated) return;
  indexedDbSessionHydrated = true;

  const ownerFromMeta = readPersistedDataOwnerUid();
  const loginFromMeta = readPersistedLoginUid();

  if (!dataOwnerUid && ownerFromMeta) {
    dataOwnerUid = ownerFromMeta;
  }

  if (!loginUid && loginFromMeta) {
    loginUid = loginFromMeta;
  }

  if (!dataOwnerUid) {
    const inferred = await inferPrimaryOwnerUidFromIndexedDb();
    if (inferred) {
      dataOwnerUid = inferred;
      persistDataOwnerUid(inferred);
    }
  }

  if (dataOwnerUid || loginUid) {
    notifyWaiters();
  }
}

/** Reseta estado in-memory — apenas testes automatizados. */
export function resetAuthUidStateForTests(): void {
  indexedDbSessionHydrated = false;
  loginUid = null;
  dataOwnerUid = null;
  authReady = false;
  legacyOwnerMigrationDoneFor = null;
}

/** Força nova migração de owners legados (ex.: após importar CSV). */
export function invalidateLegacyOwnerMigrationCache(): void {
  legacyOwnerMigrationDoneFor = null;
}

function resolveUidFromFirebase(): string | null {
  return null;
}

export function setAuthUidState(
  nextLoginUid: string | null,
  nextDataOwnerUid: string | null,
  ready: boolean,
): void {
  const prevOwner = dataOwnerUid;
  if (nextLoginUid != null) {
    loginUid = nextLoginUid;
    dataOwnerUid = nextDataOwnerUid ?? nextLoginUid;
    persistDataOwnerUid(dataOwnerUid);
    persistLoginUid(nextLoginUid);
  } else {
    loginUid = null;
    clearPersistedLoginUid();
    if (nextDataOwnerUid != null) {
      dataOwnerUid = nextDataOwnerUid;
      persistDataOwnerUid(nextDataOwnerUid);
    } else {
      dataOwnerUid = readPersistedDataOwnerUid() ?? dataOwnerUid;
    }
  }
  if (prevOwner !== dataOwnerUid) {
    legacyOwnerMigrationDoneFor = null;
  }
  authReady = ready;
  notifyWaiters();
}

/** Encerra login Firebase mantendo ownerUid local para continuar offline. */
export async function enterOfflineStorageSession(): Promise<string | null> {
  await hydrateAuthUidFromIndexedDb();
  const owner = getCachedDataOwnerUid();
  setAuthUidState(null, owner, true);
  return owner;
}

/** Limpa vínculo persistido (ex.: após "Excluir todos os dados"). */
export function clearPersistedStorageOwner(): void {
  clearPersistedDataOwnerUid();
  if (!loginUid) {
    dataOwnerUid = null;
  }
}

export function getCachedLoginUid(): string | null {
  return loginUid ?? resolveUidFromFirebase() ?? readPersistedLoginUid();
}

export function getCachedDataOwnerUid(): string | null {
  if (dataOwnerUid) return dataOwnerUid;
  const persistedOwner = readPersistedDataOwnerUid();
  if (persistedOwner) return persistedOwner;
  return loginUid ?? resolveUidFromFirebase() ?? null;
}

/** Membro autorizado: loginUid ≠ dataOwnerUid (chefe) persistido no Dexie meta. */
export function isPersistedAuthorizedMemberSession(): boolean {
  const persistedLogin = readPersistedLoginUid();
  const persistedOwner = readPersistedDataOwnerUid();
  return Boolean(persistedLogin && persistedOwner && persistedLogin !== persistedOwner);
}

/** Aguarda auth e devolve UID para leitura/gravação local (Dexie). */
export async function resolveStorageOwnerUid(): Promise<string | null> {
  const { hydrateAppMetaFromIndexedDb } = await import('../../offline-first/db/appMeta');
  await hydrateAppMetaFromIndexedDb();
  await hydrateAuthUidFromIndexedDb();

  let owner = getCachedDataOwnerUid();
  const login = getCachedLoginUid();

  // Backup CSV legado (Firebase) pode ter sobrescrito session:dataOwnerUid.
  // Com login Supabase (UUID), realinha a sessão para a conta atual.
  if (login && isCloudOwnerUid(login) && owner && !isCloudOwnerUid(owner)) {
    setAuthUidState(login, login, true);
    owner = login;
    legacyOwnerMigrationDoneFor = null;
  }

  if (!owner) {
    if (!authReady) {
      await waitForAuthUid();
    }
    owner = getCachedDataOwnerUid();
  }

  if (owner && isCloudOwnerUid(owner) && legacyOwnerMigrationDoneFor !== owner) {
    try {
      const { migrateLegacyFirebaseOwnersToCloudUid } = await import(
        '../../offline-first/db/migration'
      );
      await migrateLegacyFirebaseOwnersToCloudUid(owner);
      legacyOwnerMigrationDoneFor = owner;
    } catch (error) {
      console.warn('[auth] migrateLegacyFirebaseOwnersToCloudUid falhou:', error);
    }
  }

  return owner;
}

/** @deprecated use getCachedDataOwnerUid */
export function getCachedAuthUid(): string | null {
  return getCachedDataOwnerUid();
}

export function isAuthUidReady(): boolean {
  return authReady;
}

export function waitForAuthUid(): Promise<string | null> {
  if (authReady) {
    return Promise.resolve(getCachedDataOwnerUid());
  }
  return new Promise((resolve) => {
    const handler = (uid: string | null) => {
      waiters.delete(handler);
      resolve(uid ?? getCachedDataOwnerUid());
    };
    waiters.add(handler);
  });
}

/** Aguarda UID dono dos dados não nulo (login concluído). */
export async function waitForAuthenticatedUid(timeoutMs = 20000): Promise<string | null> {
  const immediate = await waitForAuthUid();
  if (immediate) return immediate;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(handler);
      resolve(getCachedDataOwnerUid());
    }, timeoutMs);

    const handler = (uid: string | null) => {
      const resolved = uid ?? getCachedDataOwnerUid();
      if (!resolved) return;
      clearTimeout(timer);
      waiters.delete(handler);
      resolve(resolved);
    };
    waiters.add(handler);
  });
}
