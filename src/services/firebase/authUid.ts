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

export function setAuthUidState(uid: string | null, ready: boolean): void {
  currentUid = uid;
  authReady = ready;
  notifyWaiters();
}

export function getCachedAuthUid(): string | null {
  return currentUid;
}

export function isAuthUidReady(): boolean {
  return authReady;
}

export function waitForAuthUid(): Promise<string | null> {
  if (authReady) {
    return Promise.resolve(currentUid);
  }
  return new Promise((resolve) => {
    const handler = (uid: string | null) => {
      waiters.delete(handler);
      resolve(uid);
    };
    waiters.add(handler);
  });
}
