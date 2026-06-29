import { getTafDatabase } from '../db/tafDatabase';
import { STATUS_SYNCED } from './syncStatus';
import { getLastSuccessfulSyncAudit } from './syncAudit';
import type { SyncQueueBreakdown } from './syncQueueBreakdown';
import { EMPTY_SYNC_QUEUE_BREAKDOWN } from './syncQueueBreakdown';
import type { SyncCountersState } from './syncUiState';

export type SyncCounters = SyncCountersState;

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
  const last = await getLastSuccessfulSyncAudit(ownerUid);
  return last?.finishedAt ?? null;
}

export async function buildSyncCounters(
  ownerUid: string,
  pendingUploads: number,
  pendingDownloads: number | null = null,
  options?: {
    uploadBreakdown?: SyncQueueBreakdown;
    downloadBreakdown?: SyncQueueBreakdown;
  },
): Promise<SyncCountersState> {
  const syncedTotal = await getSyncedRecordCount(ownerUid);
  return {
    pendingUploads,
    pendingDownloads,
    syncedTotal,
    uploadBreakdown: options?.uploadBreakdown ?? EMPTY_SYNC_QUEUE_BREAKDOWN,
    downloadBreakdown: options?.downloadBreakdown ?? EMPTY_SYNC_QUEUE_BREAKDOWN,
  };
}
