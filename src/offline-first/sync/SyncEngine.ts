import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import {
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
  getAllCadastrosFirestoreLight,
} from '../../services/firebase/cadastrosFirestore';
import {
  addSessaoFirestore,
  deleteSessaoFirestore,
  getAllSessoesFirestoreLight,
  updateSessaoFirestore,
} from '../../services/firebase/sessoesFirestore';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import type { CadastroRecord, SessaoRecord, SyncQueueEntry } from '../types';
import {
  applyRemoteCadastro,
  applyRemoteSessao,
  listCadastros,
  listSessoes,
  putCadastroRecord,
  putSessaoRecord,
} from '../db/localDb';
import { getMeta, setMeta } from '../db/tafDatabase';
import { syncQueue } from './SyncQueue';
import { syncLogger } from './SyncLogger';
import { connectivityMonitor } from './ConnectivityMonitor';
import { startRealtimeSync, stopRealtimeSync } from './RealtimeBridge';
import { systemState } from './SystemState';
import { getPendingSyncItems } from './pendingSyncItems';
import {
  beginCloudSync,
  endCloudSync,
  setCloudSyncResult,
  setSyncProgress,
} from '../../services/offline/cloudSyncActivity';

type StoreListener = () => void;

const BACKOFF_BASE_MS = 1500;
const BACKOFF_MAX_MS = 60_000;

let ownerUid: string | null = null;
let processing = false;
let processTimer: ReturnType<typeof setTimeout> | null = null;
let connectivityUnsub: (() => void) | null = null;
let listeners = new Set<StoreListener>();
let lastPullAt = 0;
const MIN_PULL_MS = 45_000;
const MIN_PROCESS_GAP_MS = 12_000;
let lastProcessFinishedAt = 0;

function notify(): void {
  listeners.forEach((fn) => fn());
}

function backoffDelay(retries: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, retries));
}

async function executeQueueItem(entry: SyncQueueEntry): Promise<void> {
  const uid = entry.ownerUid;
  const payload = JSON.parse(entry.payload) as Record<string, unknown>;

  if (entry.collection === 'cadastros') {
    if (payload.kind === 'cadastrosBatch' && Array.isArray(payload.items)) {
      const items = payload.items as CadastroItemPersist[];
      for (let i = 0; i < items.length; i += 500) {
        await addCadastrosEmLoteFirestore(uid, items.slice(i, i + 500));
      }
      for (const item of items) {
        const row = item as CadastroRecord;
        await putCadastroRecord({ ...row, ownerUid: uid, syncStatus: 'synced' });
      }
      return;
    }
    if (entry.operationType === 'DELETE') {
      await deleteCadastroFirestore(uid, entry.documentId);
      const dbCad = await listCadastros(uid, true);
      const row = dbCad.find((c) => c.id === entry.documentId);
      if (row) await putCadastroRecord({ ...row, syncStatus: 'synced' });
      return;
    }
    await addCadastroFirestore(uid, payload as CadastroItemPersist);
    const saved = payload as CadastroRecord;
    await putCadastroRecord({ ...saved, ownerUid: uid, syncStatus: 'synced' });
    return;
  }

  if (entry.operationType === 'DELETE') {
    await deleteSessaoFirestore(uid, entry.documentId);
    return;
  }

  const sessao = payload as SessaoAplicacaoTaf;
  if (entry.operationType === 'CREATE') {
    await addSessaoFirestore(uid, sessao);
  } else {
    await updateSessaoFirestore(uid, sessao);
  }
  await putSessaoRecord({ ...(payload as SessaoRecord), ownerUid: uid, syncStatus: 'synced' });
}

export class SyncEngine {
  async init(dataOwnerUid: string): Promise<void> {
    ownerUid = dataOwnerUid;
    await systemState.hydrate();
    await getMeta(`migrated:${dataOwnerUid}`);
    connectivityMonitor.start();
    stopRealtimeSync();

    connectivityUnsub?.();
    let prevConn = connectivityMonitor.getState();
    connectivityUnsub = connectivityMonitor.subscribe((state) => {
      const cameOnline =
        (state === 'ONLINE' || state === 'DEGRADED') && prevConn === 'OFFLINE';
      prevConn = state;
      if (cameOnline && systemState.canUseFirebase()) {
        void this.scheduleProcess(false);
      }
    });

    if (systemState.isForcedOffline()) {
      return;
    }

    const pending = await getPendingSyncItems(dataOwnerUid);
    if (pending.total > 0) {
      notify();
      return;
    }

    startRealtimeSync(dataOwnerUid, () => notify());
    await this.scheduleProcess(true);
  }

  /** Ativa modo online: tempo real + pull após upload confirmado. */
  async enableOnlineMode(): Promise<void> {
    if (!ownerUid || systemState.isForcedOffline()) return;
    stopRealtimeSync();
    startRealtimeSync(ownerUid, () => notify());
    lastPullAt = 0;
    lastProcessFinishedAt = 0;
    await this.scheduleProcess(true);
  }

  /**
   * Envia apenas pendentes (upload idempotente via fila).
   * Não faz pull até confirmação de escrita.
   */
  async uploadPendingOnly(): Promise<{ success: boolean; error?: string }> {
    if (!ownerUid) return { success: false, error: 'no_owner' };
    if (!connectivityMonitor.canSync()) return { success: false, error: 'offline' };

    lastProcessFinishedAt = 0;
    await syncQueue.resetFailedToPending(ownerUid);

    const uploaded = await this.processQueue({ uploadOnly: true, bypassGap: true, forceUpload: true });
    if (!uploaded) return { success: false, error: 'upload_failed' };

    const still = await getPendingSyncItems(ownerUid);
    if (still.total > 0) return { success: false, error: 'pending_remain' };

    await syncQueue.clearDone(ownerUid);
    await systemState.setOnlineActive();
    await this.enableOnlineMode();
    return { success: true };
  }

  shutdown(): void {
    stopRealtimeSync();
    connectivityUnsub?.();
    connectivityUnsub = null;
    ownerUid = null;
    if (processTimer) clearTimeout(processTimer);
    processTimer = null;
  }

  subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  scheduleProcess(immediate = false): Promise<void> {
    if (!ownerUid || systemState.isForcedOffline()) return Promise.resolve();
    if (processTimer) clearTimeout(processTimer);
    return new Promise((resolve) => {
      processTimer = setTimeout(() => {
        void this.processQueue().finally(() => resolve());
      }, immediate ? 50 : 800);
    });
  }

  async processQueue(options?: {
    uploadOnly?: boolean;
    bypassGap?: boolean;
    forceUpload?: boolean;
  }): Promise<boolean> {
    if (!ownerUid || processing || !connectivityMonitor.canSync()) return false;
    if (systemState.isForcedOffline() && !options?.forceUpload) return false;
    if (!options?.bypassGap && Date.now() - lastProcessFinishedAt < MIN_PROCESS_GAP_MS) return false;

    if (!options?.forceUpload && ownerUid) {
      const blocked = await getPendingSyncItems(ownerUid);
      if (blocked.total > 0) {
        notify();
        return false;
      }
    }

    processing = true;
    connectivityMonitor.setSyncing(true);
    beginCloudSync();
    setSyncProgress(10);

    try {
      const pending = await syncQueue.listPending(ownerUid);
      setSyncProgress(25);

      for (let i = 0; i < pending.length; i++) {
        const item = pending[i]!;
        await syncQueue.markProcessing(item.operationId);
        try {
          await executeQueueItem(item);
          await syncQueue.markDone(item.operationId);
          setSyncProgress(25 + Math.round(((i + 1) / Math.max(pending.length, 1)) * 40));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          await syncQueue.markFailed(item.operationId, msg, item.retries + 1);
          await syncLogger.error('queue', msg, { operationId: item.operationId });
          await new Promise((r) => setTimeout(r, backoffDelay(item.retries + 1)));
        }
      }

      setSyncProgress(70);
      if (!options?.uploadOnly && systemState.canUseFirebase()) {
        await this.pullFromRemote(false);
      }
      setSyncProgress(100);
      setCloudSyncResult(true);
      notify();
      return true;
    } catch (error) {
      await syncLogger.error('sync', error instanceof Error ? error.message : String(error));
      setCloudSyncResult(false);
      return false;
    } finally {
      processing = false;
      lastProcessFinishedAt = Date.now();
      connectivityMonitor.setSyncing(false);
      endCloudSync();
    }
  }

  /** Após wipe local/nuvem — evita loop de sync e marca estado ocioso. */
  async resetAfterWipe(dataOwnerUid: string): Promise<void> {
    lastPullAt = Date.now();
    lastProcessFinishedAt = Date.now();
    await setMeta(`lastPull:${dataOwnerUid}`, String(lastPullAt));
  }

  async pullFromRemote(force = false): Promise<void> {
    if (!ownerUid || !connectivityMonitor.canSync() || !systemState.canUseFirebase()) return;
    if (!force && Date.now() - lastPullAt < MIN_PULL_MS) return;

    const [remoteCadastros, remoteSessoes] = await Promise.all([
      getAllCadastrosFirestoreLight(ownerUid),
      getAllSessoesFirestoreLight(ownerUid),
    ]);

    for (const cad of remoteCadastros) {
      await applyRemoteCadastro(
        {
          ...cad,
          ownerUid,
          version: cad.updatedAt ? 1 : 1,
          syncStatus: 'synced',
          deleted: false,
          deviceId: 'remote',
          userId: getCachedLoginUid(),
          createdAt: cad.updatedAt ?? Date.now(),
          lastModifiedBy: 'remote',
        },
        ownerUid,
      );
    }

    for (const sess of remoteSessoes) {
      await applyRemoteSessao(
        {
          ...sess,
          ownerUid,
          version: 1,
          syncStatus: 'synced',
          deleted: false,
          deviceId: 'remote',
          userId: getCachedLoginUid(),
          createdAt: Date.parse(sess.criadoEm) || Date.now(),
          lastModifiedBy: 'remote',
        },
        ownerUid,
      );
    }

    lastPullAt = Date.now();
    await setMeta(`lastPull:${ownerUid}`, String(lastPullAt));
    await syncLogger.info('sync', `Pull concluído: ${remoteCadastros.length} cadastros, ${remoteSessoes.length} sessões`);
    notify();
  }

  async forceSync(): Promise<void> {
    if (!ownerUid || systemState.isForcedOffline()) return;
    lastPullAt = 0;
    lastProcessFinishedAt = 0;
    await syncQueue.resetFailedToPending(ownerUid);
    await this.processQueue({ bypassGap: true });
  }

  async getPendingCount(): Promise<number> {
    if (!ownerUid) return 0;
    return syncQueue.countPending(ownerUid);
  }
}

export const syncEngine = new SyncEngine();

/** Compatibilidade: notifica ouvintes legados após mutação local. */
export function notifyDataChanged(): void {
  notify();
}

export function subscribeDataChanged(listener: StoreListener): () => void {
  return syncEngine.subscribe(listener);
}
