const PENDING_SYNC_KEY = 'taf:pendingSyncAfterAuth';
const PENDING_SYNC_MSG_KEY = 'taf:syncResumeMessage';

export const SYNC_AUTH_REDIRECT = 'SYNC_AUTH_REDIRECT';

function readStorage(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      const v = localStorage.getItem(key);
      if (v) return v;
    } catch {
      // ignore
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      return sessionStorage.getItem(key);
    } catch {
      // ignore
    }
  }
  return null;
}

function writeStorage(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function removeStorage(key: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function markPendingSyncResume(message?: string): void {
  writeStorage(PENDING_SYNC_KEY, String(Date.now()));
  if (message) {
    writeStorage(PENDING_SYNC_MSG_KEY, message);
  }
}

export function clearPendingSyncResume(): void {
  removeStorage(PENDING_SYNC_KEY);
  removeStorage(PENDING_SYNC_MSG_KEY);
}

export function consumePendingSyncResume(): boolean {
  const v = readStorage(PENDING_SYNC_KEY);
  if (!v) return false;
  removeStorage(PENDING_SYNC_KEY);
  return true;
}

export function hasPendingSyncResume(): boolean {
  return readStorage(PENDING_SYNC_KEY) != null;
}

export function consumeSyncResumeMessage(): string | null {
  const msg = readStorage(PENDING_SYNC_MSG_KEY);
  if (msg) removeStorage(PENDING_SYNC_MSG_KEY);
  return msg;
}

export function peekSyncResumeMessage(): string | null {
  return readStorage(PENDING_SYNC_MSG_KEY);
}
