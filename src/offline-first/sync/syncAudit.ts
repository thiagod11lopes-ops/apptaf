import { getTafDatabase } from '../db/tafDatabase';
import { getDeviceId } from '../deviceId';
import type { SyncAuditEntry } from '../types';

export type { SyncAuditEntry };

export async function appendSyncAudit(
  partial: Omit<SyncAuditEntry, 'id' | 'durationMs' | 'strategy' | 'result' | 'failures'> & {
    result?: SyncAuditEntry['result'];
    failures?: number;
  },
): Promise<SyncAuditEntry> {
  const db = getTafDatabase();
  const deviceId = partial.deviceId === 'unknown' ? await getDeviceId() : partial.deviceId;
  const failures = partial.failures ?? partial.errors.length;
  let result = partial.result;
  if (!result) {
    if (failures === 0) result = 'SUCCESS';
    else if (partial.uploads + partial.downloads > 0) result = 'PARTIAL_SUCCESS';
    else result = 'FAILED';
  }

  const entry: SyncAuditEntry = {
    ...partial,
    deviceId,
    failures,
    result,
    durationMs: Math.max(0, partial.finishedAt - partial.startedAt),
    strategy: 'last_write_wins',
  };

  if (db) {
    const id = await db.syncAuditHistory.add(entry);
    entry.id = id;
  }

  return entry;
}

export async function getLastSyncAudit(ownerUid: string): Promise<SyncAuditEntry | undefined> {
  const db = getTafDatabase();
  if (!db) return undefined;
  return db.syncAuditHistory.where('ownerUid').equals(ownerUid).reverse().first();
}

/** Última sync bem-sucedida — ignora tentativas FAILED exibidas como "última sync". */
export async function getLastSuccessfulSyncAudit(ownerUid: string): Promise<SyncAuditEntry | undefined> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return undefined;
  const recent = await db.syncAuditHistory.where('ownerUid').equals(ownerUid).reverse().limit(30).toArray();
  return recent.find((entry) => entry.result === 'SUCCESS' || entry.result === 'PARTIAL_SUCCESS');
}

export async function listSyncAuditHistory(ownerUid: string, limit = 50): Promise<SyncAuditEntry[]> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return [];
  return db.syncAuditHistory.where('ownerUid').equals(ownerUid).reverse().limit(limit).toArray();
}
