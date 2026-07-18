import { afterAll, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests, getTafDatabase } from '../../src/offline-first/db/tafDatabase';
import {
  PROCESSING_LEASE_MS,
  SyncQueue,
  queueBackoffDelayMs,
  syncQueue,
} from '../../src/offline-first/sync/SyncQueue';
import type { SyncQueueEntry } from '../../src/offline-first/types';

const OWNER = 'owner-queue-retry-1';

describe('SyncQueue — crash recovery + retry seguro (7.4)', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await closeTafDatabaseForTests();
  });

  it('TESTE 1 — processing stale (>10min) volta a pending após recovery', async () => {
    const entry = await syncQueue.enqueue({
      operationType: 'UPDATE',
      collection: 'cadastros',
      documentId: 'cad-stale-1',
      payload: { id: 'cad-stale-1' },
      ownerUid: OWNER,
    });
    // `now` depois do enqueue: nextAttemptAt usa Date.now() no put e não pode ficar no futuro.
    const now = Date.now();
    const claimed = await syncQueue.claimForProcessing(entry.operationId, undefined, now);
    expect(claimed?.status).toBe('processing');

    // Simula lease expirado sem fake timers (Dexie + fake timers trava).
    await getTafDatabase()!.syncQueue.update(entry.operationId, {
      processingStartedAt: now - PROCESSING_LEASE_MS - 60_000,
    });

    const recovered = await syncQueue.recoverStaleProcessing(OWNER, now);
    expect(recovered).toBe(1);

    const row = await getTafDatabase()!.syncQueue.get(entry.operationId);
    expect(row?.status).toBe('pending');
    expect(row?.attemptId).toBeUndefined();
    expect(row?.retries).toBe(0);
  });

  it('TESTE 2 — pending → processing → done com claim exclusivo', async () => {
    const entry = await syncQueue.enqueue({
      operationType: 'UPDATE',
      collection: 'cadastros',
      documentId: 'cad-ok-1',
      payload: { id: 'cad-ok-1' },
      ownerUid: OWNER,
    });

    const qA = new SyncQueue();
    const qB = new SyncQueue();
    const [a, b] = await Promise.all([
      qA.claimForProcessing(entry.operationId),
      qB.claimForProcessing(entry.operationId),
    ]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);

    const winner = winners[0]!;
    expect(await syncQueue.markDone(winner.operationId, winner.attemptId)).toBe(true);
    const row = await getTafDatabase()!.syncQueue.get(entry.operationId);
    expect(row?.status).toBe('done');
  });

  it('TESTE 3 — falha agenda backoff via nextAttemptAt', async () => {
    const entry = await syncQueue.enqueue({
      operationType: 'UPDATE',
      collection: 'cadastros',
      documentId: 'cad-backoff-1',
      payload: { id: 'cad-backoff-1' },
      ownerUid: OWNER,
    });
    const now = Date.now();
    const claimed = await syncQueue.claimForProcessing(entry.operationId, undefined, now);
    expect(claimed).toBeTruthy();

    await syncQueue.markFailed(claimed!.operationId, 'network_error', 1, claimed!.attemptId, now);

    const row = (await getTafDatabase()!.syncQueue.get(entry.operationId)) as SyncQueueEntry;
    expect(row.status).toBe('pending');
    expect(row.retries).toBe(1);
    expect(row.nextAttemptAt).toBe(now + queueBackoffDelayMs(1));

    const readyEarly = await syncQueue.listReady(OWNER, 500, now + 100);
    expect(readyEarly.some((r) => r.operationId === entry.operationId)).toBe(false);

    const readyLate = await syncQueue.listReady(OWNER, 500, (row.nextAttemptAt ?? 0) + 1);
    expect(readyLate.some((r) => r.operationId === entry.operationId)).toBe(true);
  });

  it('TESTE 4 — retries >= 8 → failed', async () => {
    const entry = await syncQueue.enqueue({
      operationType: 'UPDATE',
      collection: 'cadastros',
      documentId: 'cad-fail-1',
      payload: { id: 'cad-fail-1' },
      ownerUid: OWNER,
    });
    const claimed = await syncQueue.claimForProcessing(entry.operationId);
    await syncQueue.markFailed(claimed!.operationId, 'falha-8', 8, claimed!.attemptId);

    const row = await getTafDatabase()!.syncQueue.get(entry.operationId);
    expect(row?.status).toBe('failed');
    expect(row?.retries).toBe(8);
    expect(row?.error).toBe('falha-8');

    const pending = await syncQueue.listPending(OWNER);
    expect(pending.some((p) => p.operationId === entry.operationId)).toBe(false);

    await syncQueue.resetFailedToPending(OWNER);
    const after = await getTafDatabase()!.syncQueue.get(entry.operationId);
    expect(after?.status).toBe('pending');
    expect(after?.retries).toBe(0);
  });

  it('TESTE 5 — nova edição durante retry compacta para última versão', async () => {
    await syncQueue.enqueue({
      operationType: 'UPDATE',
      collection: 'cadastros',
      documentId: 'cad-edit-1',
      payload: { id: 'cad-edit-1', nome: 'v1' },
      ownerUid: OWNER,
    });
    const first = (await syncQueue.listPending(OWNER)).find((p) => p.documentId === 'cad-edit-1');
    expect(first).toBeTruthy();

    const claimed = await syncQueue.claimForProcessing(first!.operationId);
    await syncQueue.markFailed(claimed!.operationId, 'temp', 1, claimed!.attemptId);

    await syncQueue.enqueue({
      operationType: 'UPDATE',
      collection: 'cadastros',
      documentId: 'cad-edit-1',
      payload: { id: 'cad-edit-1', nome: 'v2' },
      ownerUid: OWNER,
    });

    const pending = await syncQueue.listPending(OWNER);
    const forDoc = pending.filter((p) => p.documentId === 'cad-edit-1');
    expect(forDoc).toHaveLength(1);
    expect(JSON.parse(forDoc[0]!.payload).nome).toBe('v2');
    expect(forDoc[0]!.retries).toBe(0);
  });
});
