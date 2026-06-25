import { getFirebaseAuth } from '../../config/firebase';

const PERSISTED_OWNER_KEY = 'taf:lastDataOwnerUid';

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

function notifyWaiters() {
  for (const waiter of waiters) {
    waiter(dataOwnerUid);
  }
}

function resolveUidFromFirebase(): string | null {
  return getFirebaseAuth()?.currentUser?.uid ?? null;
}

export function setAuthUidState(
  nextLoginUid: string | null,
  nextDataOwnerUid: string | null,
  ready: boolean,
): void {
  loginUid = nextLoginUid ?? resolveUidFromFirebase();
  dataOwnerUid = nextDataOwnerUid ?? loginUid ?? resolveUidFromFirebase();
  authReady = ready;
  if (loginUid && dataOwnerUid) {
    persistDataOwnerUid(dataOwnerUid);
  } else if (ready && !loginUid) {
    clearPersistedDataOwnerUid();
  }
  notifyWaiters();
}

export function getCachedLoginUid(): string | null {
  return loginUid ?? resolveUidFromFirebase();
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
