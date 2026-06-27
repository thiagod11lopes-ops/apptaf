import { getTafDatabase } from '../db/tafDatabase';
import { getDeviceId } from '../deviceId';
import type { SyncAuditEntry } from '../types';

export type { SyncAuditEntry };

export async function appendSyncAudit(
  partial: Omit<SyncAuditEntry, 'id' | 'durationMs' | 'strategy'>,
): Promise<SyncAuditEntry> {
  const db = getTafDatabase();
  const deviceId = partial.deviceId === 'unknown' ? await getDeviceId() : partial.deviceId;
  const entry: SyncAuditEntry = {
    ...partial,
    deviceId,
    durationMs: Math.max(0, partial.finishedAt - partial.startedAt),
    strategy: 'last_write_wins',
  };

  if (db) {
    const id = await db.syncAuditHistory.add(entry);
    entry.id = id;
  }

  return entry;
}

export async function listSyncAuditHistory(ownerUid: string, limit = 50): Promise<SyncAuditEntry[]> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return [];
  return db.syncAuditHistory.where('ownerUid').equals(ownerUid).reverse().limit(limit).toArray();
}
