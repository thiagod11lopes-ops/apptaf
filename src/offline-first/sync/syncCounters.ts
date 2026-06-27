import { getTafDatabase } from '../db/tafDatabase';
import { STATUS_SYNCED } from './syncStatus';
import { getLastSyncAudit } from './syncAudit';

export type SyncCounters = {
  pendingUploads: number;
  pendingDownloads: number | null;
  syncedTotal: number;
};

export async function getSyncedRecordCount(ownerUid: string): Promise<number> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return 0;

  const [cad, sess, app] = await Promise.all([
    db.cadastros
      .where('ownerUid')
      .equals(ownerUid)
      .filter((r) => r.syncStatus === STATUS_SYNCED && r.deleted !== true)
      .count(),
    db.sessoes
      .where('ownerUid')
      .equals(ownerUid)
      .filter((r) => r.syncStatus === STATUS_SYNCED && r.deleted !== true)
      .count(),
    db.aplicadores
      .where('ownerUid')
      .equals(ownerUid)
      .filter((r) => r.syncStatus === STATUS_SYNCED && r.deleted !== true)
      .count(),
  ]);

  return cad + sess + app;
}

export async function getLastSyncTimestamp(ownerUid: string): Promise<number | null> {
  const last = await getLastSyncAudit(ownerUid);
  return last?.finishedAt ?? null;
}

export async function buildSyncCounters(
  ownerUid: string,
  pendingUploads: number,
  pendingDownloads: number | null = null,
): Promise<SyncCounters> {
  const syncedTotal = await getSyncedRecordCount(ownerUid);
  return { pendingUploads, pendingDownloads, syncedTotal };
}
