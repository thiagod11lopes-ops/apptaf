import { getFirebaseAuth } from '../../config/firebase';

/**
 * UID do login Firebase e UID dono dos dados (chefe quando membro autorizado).
 */
let authReady = false;
let loginUid: string | null = null;
let dataOwnerUid: string | null = null;
const waiters = new Set<(ownerUid: string | null) => void>();

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
  notifyWaiters();
}

export function getCachedLoginUid(): string | null {
  return loginUid ?? resolveUidFromFirebase();
}

export function getCachedDataOwnerUid(): string | null {
  return dataOwnerUid ?? loginUid ?? resolveUidFromFirebase();
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
