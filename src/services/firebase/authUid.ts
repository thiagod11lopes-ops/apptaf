import { getFirebaseAuth } from '../../config/firebase';
import { getMeta, setMeta, getTafDatabase } from '../../offline-first/db/tafDatabase';

const PERSISTED_OWNER_KEY = 'taf:lastDataOwnerUid';
const PERSISTED_LOGIN_KEY = 'taf:lastLoginUid';
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

function readPersistedDataOwnerUid(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(PERSISTED_OWNER_KEY);
  return v?.trim() || null;
}

function persistDataOwnerUid(uid: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PERSISTED_OWNER_KEY, uid);
  } catch {
    // quota / modo privado
  }
}

function clearPersistedDataOwnerUid(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PERSISTED_OWNER_KEY);
  } catch {
    // silencioso
  }
}

function persistLoginUid(uid: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PERSISTED_LOGIN_KEY, uid);
  } catch {
    // quota / modo privado
  }
}

function readPersistedLoginUid(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(PERSISTED_LOGIN_KEY);
  return v?.trim() || null;
}

function clearPersistedLoginUid(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PERSISTED_LOGIN_KEY);
  } catch {
    // silencioso
  }
}

function notifyWaiters() {
  for (const waiter of waiters) {
    waiter(dataOwnerUid);
  }
}

async function writeSessionMetaToIndexedDb(
  ownerUid: string | null | undefined,
  nextLoginUid: string | null | undefined,
): Promise<void> {
  if (!getTafDatabase()) return;
  try {
    if (ownerUid?.trim()) {
      await setMeta(META_DATA_OWNER_KEY, ownerUid.trim());
    }
    if (nextLoginUid?.trim()) {
      await setMeta(META_LOGIN_UID_KEY, nextLoginUid.trim());
    }
  } catch {
    // IndexedDB indisponível — localStorage continua como fallback.
  }
}

async function clearSessionMetaFromIndexedDb(): Promise<void> {
  if (!getTafDatabase()) return;
  try {
    await setMeta(META_DATA_OWNER_KEY, '');
    await setMeta(META_LOGIN_UID_KEY, '');
  } catch {
    // silencioso
  }
}

async function readPersistedDataOwnerUidFromIndexedDb(): Promise<string | null> {
  if (!getTafDatabase()) return null;
  try {
    const value = await getMeta(META_DATA_OWNER_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

async function readPersistedLoginUidFromIndexedDb(): Promise<string | null> {
  if (!getTafDatabase()) return null;
  try {
    const value = await getMeta(META_LOGIN_UID_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

/** Infere o ownerUid dominante quando localStorage foi apagado (comum em PWA iOS). */
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

/** Restaura owner/login do IndexedDB — sobrevive ao PWA limpar localStorage. */
export async function hydrateAuthUidFromIndexedDb(): Promise<void> {
  if (indexedDbSessionHydrated) return;
  indexedDbSessionHydrated = true;

  const [ownerFromMeta, loginFromMeta] = await Promise.all([
    readPersistedDataOwnerUidFromIndexedDb(),
    readPersistedLoginUidFromIndexedDb(),
  ]);

  if (!dataOwnerUid && ownerFromMeta) {
    dataOwnerUid = ownerFromMeta;
    persistDataOwnerUid(ownerFromMeta);
  }

  if (!loginUid && loginFromMeta) {
    loginUid = loginFromMeta;
    persistLoginUid(loginFromMeta);
  }

  if (!dataOwnerUid) {
    const inferred = await inferPrimaryOwnerUidFromIndexedDb();
    if (inferred) {
      dataOwnerUid = inferred;
      persistDataOwnerUid(inferred);
      void writeSessionMetaToIndexedDb(inferred, loginUid);
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
}

function resolveUidFromFirebase(): string | null {
  return getFirebaseAuth()?.currentUser?.uid ?? null;
}

export function setAuthUidState(
  nextLoginUid: string | null,
  nextDataOwnerUid: string | null,
  ready: boolean,
): void {
  if (nextLoginUid != null) {
    loginUid = nextLoginUid;
    dataOwnerUid = nextDataOwnerUid ?? nextLoginUid;
    persistDataOwnerUid(dataOwnerUid);
    persistLoginUid(nextLoginUid);
    void writeSessionMetaToIndexedDb(dataOwnerUid, nextLoginUid);
  } else {
    loginUid = null;
    clearPersistedLoginUid();
    dataOwnerUid = readPersistedDataOwnerUid() ?? dataOwnerUid;
  }
  authReady = ready;
  notifyWaiters();
}

/** Limpa vínculo persistido (ex.: após "Excluir todos os dados"). */
export function clearPersistedStorageOwner(): void {
  clearPersistedDataOwnerUid();
  void clearSessionMetaFromIndexedDb();
  if (!loginUid) {
    dataOwnerUid = null;
  }
}

export function getCachedLoginUid(): string | null {
  return loginUid ?? resolveUidFromFirebase() ?? readPersistedLoginUid();
}

export function getCachedDataOwnerUid(): string | null {
  return (
    dataOwnerUid ??
    loginUid ??
    resolveUidFromFirebase() ??
    readPersistedDataOwnerUid()
  );
}

/** Aguarda auth e devolve UID para leitura/gravação local (Dexie). */
export async function resolveStorageOwnerUid(): Promise<string | null> {
  await hydrateAuthUidFromIndexedDb();
  if (!authReady) {
    await waitForAuthUid();
  }
  return getCachedDataOwnerUid();
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
