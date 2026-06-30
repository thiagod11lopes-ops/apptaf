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

  /** Última mensagem de erro da fila (para exibir no modal de sync). */
  async getLatestError(ownerUid: string): Promise<string | null> {
    const db = getTafDatabase();
    if (!db) return null;
    const rows = await db.syncQueue.where('ownerUid').equals(ownerUid).toArray();
    const withError = rows
      .filter((r) => r.error?.trim())
      .sort((a, b) => b.timestamp - a.timestamp);
    return withError[0]?.error ?? null;
  }

  /** Remove todas as pendências de uma coleção (ex.: dispensar envio de cadastros). */
  async clearPendingForCollection(ownerUid: string, collection: CollectionName): Promise<number> {
    const db = getTafDatabase();
    if (!db) return 0;
    const rows = await db.syncQueue.where('ownerUid').equals(ownerUid).toArray();
    const toDelete = rows.filter(
      (r) =>
        r.collection === collection &&
        (r.status === 'pending' || r.status === 'failed' || r.status === 'processing'),
    );
    if (toDelete.length > 0) {
      await db.syncQueue.bulkDelete(toDelete.map((r) => r.operationId));
    }
    return toDelete.length;
  }

  /** Remove pendências de um documento após gravação direta na nuvem. */
  async clearPendingForDocument(
    ownerUid: string,
    collection: CollectionName,
    documentId: string,
  ): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    const rows = await db.syncQueue.where('ownerUid').equals(ownerUid).toArray();
    const toDelete = rows.filter(
      (r) =>
        r.collection === collection &&
        r.documentId === documentId &&
        (r.status === 'pending' || r.status === 'failed' || r.status === 'processing'),
    );
    if (toDelete.length > 0) {
      await db.syncQueue.bulkDelete(toDelete.map((r) => r.operationId));
    }
  }

  /** Move itens da fila de outro ownerUid (ex.: __local__) para a conta logada. */
  async reassignPendingOwner(fromOwnerUids: string[], toOwnerUid: string): Promise<number> {
    const db = getTafDatabase();
    if (!db || !toOwnerUid.trim()) return 0;

    let moved = 0;
    for (const fromUid of fromOwnerUids) {
      if (!fromUid || fromUid === toOwnerUid) continue;
      const rows = await db.syncQueue.where('ownerUid').equals(fromUid).toArray();
      for (const row of rows) {
        if (row.status === 'done') continue;
        await db.syncQueue.update(row.operationId, { ownerUid: toOwnerUid });
        moved += 1;
      }
    }
    return moved;
  }
}

export const syncQueue = new SyncQueue();
