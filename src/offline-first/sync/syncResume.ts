const PENDING_SYNC_KEY = 'taf:pendingSyncAfterAuth';

export const SYNC_AUTH_REDIRECT = 'SYNC_AUTH_REDIRECT';

export function markPendingSyncResume(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_SYNC_KEY, String(Date.now()));
  } catch {
    // modo privado / quota
  }
}

export function clearPendingSyncResume(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    // silencioso
  }
}

export function consumePendingSyncResume(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const v = sessionStorage.getItem(PENDING_SYNC_KEY);
    if (!v) return false;
    sessionStorage.removeItem(PENDING_SYNC_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasPendingSyncResume(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(PENDING_SYNC_KEY) != null;
  } catch {
    return false;
  }
}
