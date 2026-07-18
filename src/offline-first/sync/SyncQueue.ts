import type { CollectionName, OperationType, QueueStatus, SyncQueueEntry } from '../types';
import { getTafDatabase } from '../db/tafDatabase';
import { syncLogger } from './SyncLogger';

/** Lease de processing — após isso o item volta a pending (crash recovery). */
export const PROCESSING_LEASE_MS = 10 * 60 * 1000;

export const BACKOFF_BASE_MS = 1500;
export const BACKOFF_MAX_MS = 60_000;
export const MAX_QUEUE_RETRIES = 8;

function randomOpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function queueBackoffDelayMs(retries: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, retries));
}

function isStaleProcessing(entry: SyncQueueEntry, now: number): boolean {
  if (entry.status !== 'processing') return false;
  const started = entry.processingStartedAt ?? entry.timestamp;
  return now - started >= PROCESSING_LEASE_MS;
}

export class SyncQueue {
  async enqueue(params: {
    operationType: OperationType;
    collection: CollectionName;
    documentId: string;
    payload?: unknown;
    ownerUid: string;
  }): Promise<SyncQueueEntry> {
    const db = getTafDatabase();
    const entry: SyncQueueEntry = {
      operationId: randomOpId(),
      operationType: params.operationType,
      collection: params.collection,
      documentId: params.documentId,
      payload: JSON.stringify(params.payload ?? {}),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      ownerUid: params.ownerUid,
      nextAttemptAt: Date.now(),
    };

    if (db) {
      await this.compactAndPut(db, entry);
    }

    await syncLogger.info('queue', `Enfileirado ${params.operationType} ${params.collection}`, {
      operationId: entry.operationId,
      collection: params.collection,
    });

    return entry;
  }

  private async compactAndPut(
    db: NonNullable<ReturnType<typeof getTafDatabase>>,
    entry: SyncQueueEntry,
  ): Promise<void> {
    // Compacta pending + failed do mesmo doc; nunca apaga processing com lease vivo.
    const rows = await db.syncQueue.where('ownerUid').equals(entry.ownerUid).toArray();
    const sameDoc = rows.filter(
      (p) =>
        p.collection === entry.collection &&
        p.documentId === entry.documentId &&
        (p.status === 'pending' || p.status === 'failed'),
    );

    if (sameDoc.length > 0) {
      await db.syncQueue.bulkDelete(sameDoc.map((s) => s.operationId));
    }

    await db.syncQueue.put(entry);
  }

  /**
   * Recupera itens `processing` cujo lease expirou (crash/reload).
   * Mantém `retries`; limpa claim; volta a `pending`.
   */
  async recoverStaleProcessing(ownerUid: string, now = Date.now()): Promise<number> {
    const db = getTafDatabase();
    if (!db || !ownerUid.trim()) return 0;

    const processing = await db.syncQueue
      .where('[ownerUid+status]')
      .equals([ownerUid, 'processing'])
      .toArray();

    let recovered = 0;
    for (const entry of processing) {
      if (!isStaleProcessing(entry, now)) continue;
      const ageMs = now - (entry.processingStartedAt ?? entry.timestamp);
      await db.syncQueue.update(entry.operationId, {
        status: 'pending' as QueueStatus,
        processingStartedAt: undefined,
        attemptId: undefined,
        nextAttemptAt: now,
      });
      recovered += 1;
      await syncLogger.info('queue', 'recovered_stale_processing', {
        operationId: entry.operationId,
        collection: entry.collection,
        retries: entry.retries,
        ageMs,
      });
    }
    return recovered;
  }

  /**
   * Claim atômico: só passa de pending → processing se elegível.
   * Retorna a entry claimada ou null se outro worker ganhou / backoff ativo.
   */
  async claimForProcessing(
    operationId: string,
    attemptId = randomOpId(),
    now = Date.now(),
  ): Promise<SyncQueueEntry | null> {
    const db = getTafDatabase();
    if (!db) return null;

    return db.transaction('rw', db.syncQueue, async () => {
      const entry = await db.syncQueue.get(operationId);
      if (!entry) return null;
      if (entry.status !== 'pending') return null;
      if ((entry.nextAttemptAt ?? 0) > now) return null;

      const claimed: SyncQueueEntry = {
        ...entry,
        status: 'processing',
        processingStartedAt: now,
        lastAttemptAt: now,
        attemptId,
      };
      await db.syncQueue.put(claimed);
      return claimed;
    });
  }

  /** @deprecated prefer claimForProcessing — mantido para compatibilidade. */
  async markProcessing(operationId: string): Promise<void> {
    await this.claimForProcessing(operationId);
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

  /** Pending elegíveis agora (backoff vencido), após recovery de stale. */
  async listReady(ownerUid: string, limit = 500, now = Date.now()): Promise<SyncQueueEntry[]> {
    await this.recoverStaleProcessing(ownerUid, now);
    const pending = await this.listPending(ownerUid, limit * 2);
    return pending.filter((row) => (row.nextAttemptAt ?? 0) <= now).slice(0, limit);
  }

  async countPending(ownerUid: string): Promise<number> {
    const db = getTafDatabase();
    if (!db) return 0;
    return db.syncQueue.where('[ownerUid+status]').equals([ownerUid, 'pending']).count();
  }

  async markDone(operationId: string, attemptId?: string): Promise<boolean> {
    const db = getTafDatabase();
    if (!db) return false;

    return db.transaction('rw', db.syncQueue, async () => {
      const entry = await db.syncQueue.get(operationId);
      if (!entry) return false;
      if (attemptId && entry.attemptId && entry.attemptId !== attemptId) return false;
      await db.syncQueue.put({
        ...entry,
        status: 'done',
        processingStartedAt: undefined,
        attemptId: undefined,
        nextAttemptAt: undefined,
      });
      return true;
    });
  }

  async markFailed(
    operationId: string,
    error: string,
    retries: number,
    attemptId?: string,
    now = Date.now(),
  ): Promise<boolean> {
    const db = getTafDatabase();
    if (!db) return false;

    const sanitized =
      error.length > 400 ? `${error.slice(0, 400)}…` : error;
    const status: QueueStatus = retries >= MAX_QUEUE_RETRIES ? 'failed' : 'pending';
    const nextAttemptAt =
      status === 'pending' ? now + queueBackoffDelayMs(retries) : undefined;

    return db.transaction('rw', db.syncQueue, async () => {
      const entry = await db.syncQueue.get(operationId);
      if (!entry) return false;
      if (attemptId && entry.attemptId && entry.attemptId !== attemptId) return false;
      await db.syncQueue.put({
        ...entry,
        error: sanitized,
        retries,
        status,
        processingStartedAt: undefined,
        attemptId: undefined,
        lastAttemptAt: now,
        nextAttemptAt,
      });
      return true;
    });
  }

  async resetFailedToPending(ownerUid: string): Promise<number> {
    const db = getTafDatabase();
    if (!db) return 0;
    const failed = await db.syncQueue.where('[ownerUid+status]').equals([ownerUid, 'failed']).toArray();
    const now = Date.now();
    await Promise.all(
      failed.map((f) =>
        db.syncQueue.update(f.operationId, {
          status: 'pending' as QueueStatus,
          retries: 0,
          error: undefined,
          nextAttemptAt: now,
          processingStartedAt: undefined,
          attemptId: undefined,
        }),
      ),
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
      .sort((a, b) => (b.lastAttemptAt ?? b.timestamp) - (a.lastAttemptAt ?? a.timestamp));
    return withError[0]?.error ?? null;
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
