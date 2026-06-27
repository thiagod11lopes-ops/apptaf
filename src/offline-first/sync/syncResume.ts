import {
  readAppMetaCache,
  removeAppMetaSync,
  writeAppMetaSync,
} from '../db/appMeta';

const PENDING_SYNC_META_KEY = 'sync:pendingResumeAt';
const PENDING_SYNC_MSG_META_KEY = 'sync:resumeMessage';

export const SYNC_AUTH_REDIRECT = 'SYNC_AUTH_REDIRECT';

export function markPendingSyncResume(message?: string): void {
  writeAppMetaSync(PENDING_SYNC_META_KEY, String(Date.now()));
  if (message) {
    writeAppMetaSync(PENDING_SYNC_MSG_META_KEY, message);
  }
}

export function clearPendingSyncResume(): void {
  removeAppMetaSync(PENDING_SYNC_META_KEY);
  removeAppMetaSync(PENDING_SYNC_MSG_META_KEY);
}

export function consumePendingSyncResume(): boolean {
  const v = readAppMetaCache(PENDING_SYNC_META_KEY);
  if (!v) return false;
  removeAppMetaSync(PENDING_SYNC_META_KEY);
  return true;
}

export function hasPendingSyncResume(): boolean {
  return readAppMetaCache(PENDING_SYNC_META_KEY) != null;
}

export function consumeSyncResumeMessage(): string | null {
  const msg = readAppMetaCache(PENDING_SYNC_MSG_META_KEY);
  if (msg) removeAppMetaSync(PENDING_SYNC_MSG_META_KEY);
  return msg;
}

export function peekSyncResumeMessage(): string | null {
  return readAppMetaCache(PENDING_SYNC_MSG_META_KEY);
}

export const SYNC_RESUME_EVENT = 'taf:resume-sync-after-auth';

/** Dispara retomada de sync após login por redirect (AuthContext → OfflineSyncContext). */
export function dispatchSyncResumeEvent(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_RESUME_EVENT));
}
