import type { CollectionName, OperationType, QueueStatus, SyncQueueEntry } from '../types';
import { getTafDatabase } from '../db/tafDatabase';
import { syncLogger } from './SyncLogger';

function randomOpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class SyncQueue {
  async enqueue(params: {
    operationType: OperationType;
    collection: CollectionName;
    documentId: string;
    payload: unknown;
    ownerUid: string;
  }): Promise<SyncQueueEntry> {
    const db = getTafDatabase();
    const entry: SyncQueueEntry = {
      operationId: randomOpId(),
      operationType: params.operationType,
      collection: params.collection,
      documentId: params.documentId,
      payload: JSON.stringify(params.payload),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      ownerUid: params.ownerUid,
    };

    if (db) {
      await this.compactAndPut(db, entry);
    }

    await syncLogger.info('queue', `Enfileirado ${params.operationType} ${params.collection}/${params.documentId}`, {
      operationId: entry.operationId,
    });

    return entry;
  }

  private async compactAndPut(
    db: NonNullable<ReturnType<typeof getTafDatabase>>,
    entry: SyncQueueEntry,
  ): Promise<void> {
    const pending = await db.syncQueue
      .where('[ownerUid+status]')
      .equals([entry.ownerUid, 'pending'])
      .toArray();

    const sameDoc = pending.filter(
      (p) => p.collection === entry.collection && p.documentId === entry.documentId,
    );

    if (sameDoc.length > 0) {
      await db.syncQueue.bulkDelete(sameDoc.map((s) => s.operationId));
    }

    await db.syncQueue.put(entry);
  }

  async listPending(ownerUid: string, limit = 500): Promise<SyncQueueEntry[]> {
    const db = getTafDatabase();
    if (!db) return [];
    return db.syncQueue
      .where('[ownerUid+status]')
      .equals([ownerUid, 'pending'])
      .sortBy('timestamp')
      .then((rows) => rows.slice(0, limit));
  }

  async countPending(ownerUid: string): Promise<number> {
    const db = getTafDatabase();
    if (!db) return 0;
    return db.syncQueue.where('[ownerUid+status]').equals([ownerUid, 'pending']).count();
  }

  async markProcessing(operationId: string): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    await db.syncQueue.update(operationId, { status: 'processing' as QueueStatus });
  }

  async markDone(operationId: string): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    await db.syncQueue.update(operationId, { status: 'done' as QueueStatus });
  }

  async markFailed(operationId: string, error: string, retries: number): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    const status: QueueStatus = retries >= 8 ? 'failed' : 'pending';
    await db.syncQueue.update(operationId, { error, retries, status });
  }

  async resetFailedToPending(ownerUid: string): Promise<number> {
    const db = getTafDatabase();
    if (!db) return 0;
    const failed = await db.syncQueue.where('[ownerUid+status]').equals([ownerUid, 'failed']).toArray();
    await Promise.all(
      failed.map((f) => db.syncQueue.update(f.operationId, { status: 'pending', retries: 0, error: undefined })),
    );
    return failed.length;
  }

  async clearDone(ownerUid: string): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    const done = await db.syncQueue.where('[ownerUid+status]').equals([ownerUid, 'done']).toArray();
    if (done.length > 0) {
      await db.syncQueue.bulkDelete(done.map((d) => d.operationId));
    }
  }
}

export const syncQueue = new SyncQueue();
