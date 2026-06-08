import { getFirebaseAuth } from '../../config/firebase';

/**
 * Estado do UID sincronizado com AuthContext.
 * Evita ler IndexedDB vazio no celular antes do Firebase Auth restaurar a sessão.
 */
let authReady = false;
let currentUid: string | null = null;
const waiters = new Set<(uid: string | null) => void>();

function notifyWaiters() {
  for (const waiter of waiters) {
    waiter(currentUid);
  }
}

function resolveUidFromFirebase(): string | null {
  return getFirebaseAuth()?.currentUser?.uid ?? null;
}

export function setAuthUidState(uid: string | null, ready: boolean): void {
  currentUid = uid ?? resolveUidFromFirebase();
  authReady = ready;
  notifyWaiters();
}

export function getCachedAuthUid(): string | null {
  return currentUid ?? resolveUidFromFirebase();
}

export function isAuthUidReady(): boolean {
  return authReady;
}

export function waitForAuthUid(): Promise<string | null> {
  if (authReady) {
    return Promise.resolve(currentUid ?? resolveUidFromFirebase());
  }
  return new Promise((resolve) => {
    const handler = (uid: string | null) => {
      waiters.delete(handler);
      resolve(uid ?? resolveUidFromFirebase());
    };
    waiters.add(handler);
  });
}

/** Aguarda UID não nulo (login concluído). Timeout evita espera infinita no Safari. */
export async function waitForAuthenticatedUid(timeoutMs = 20000): Promise<string | null> {
  const immediate = await waitForAuthUid();
  if (immediate) return immediate;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(handler);
      resolve(resolveUidFromFirebase());
    }, timeoutMs);

    const handler = (uid: string | null) => {
      const resolved = uid ?? resolveUidFromFirebase();
      if (!resolved) return;
      clearTimeout(timer);
      waiters.delete(handler);
      resolve(resolved);
    };
    waiters.add(handler);
  });
}
