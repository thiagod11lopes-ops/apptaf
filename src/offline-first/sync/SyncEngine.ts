import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import {
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
  getAllCadastrosFirestoreLight,
} from '../../services/firebase/cadastrosFirestore';
import {
  addAplicadorFirestore,
  deleteAplicadorFirestore,
  getAllAplicadoresFirestore,
} from '../../services/firebase/aplicadoresFirestore';
import {
  addSessaoFirestore,
  deleteSessaoFirestore,
  getAllSessoesFirestoreLight,
  updateSessaoFirestore,
} from '../../services/firebase/sessoesFirestore';
import { getCachedLoginUid, getCachedDataOwnerUid, waitForAuthenticatedUid } from '../../services/firebase/authUid';
import { applyTeamWipeIfNeeded } from '../../services/applyTeamWipeIfNeeded';
import type { AplicadorRecord, CadastroRecord, SessaoRecord, SyncQueueEntry } from '../types';
import {
  applyRemoteAplicador,
  applyRemoteCadastro,
  applyRemoteSessao,
  ANONYMOUS_OWNER,
  listAplicadores,
  listCadastros,
  listSessoes,
  putAplicadorRecord,
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
  withCloudUpload,
} from '../../services/offline/cloudSyncActivity';
import { confirmCloudDisplayReady } from './cloudDisplayGate';
import { migrateAnonymousDexieToOwner } from '../db/migration';

type StoreListener = () => void;

const BACKOFF_BASE_MS = 1500;
const BACKOFF_MAX_MS = 60_000;

let ownerUid: string | null = null;
let onlineModeUid: string | null = null;
let processing = false;
let processTimer: ReturnType<typeof setTimeout> | null = null;
let connectivityUnsub: (() => void) | null = null;
let listeners = new Set<StoreListener>();
let lastPullAt = 0;
const MIN_PULL_MS = 45_000;
const MIN_PROCESS_GAP_MS = 12_000;
const REALTIME_FLUSH_MS = 60;
const CLOUD_PULL_TIMEOUT_MS = 35_000;
let lastProcessFinishedAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

function backoffDelay(retries: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, retries));
}

/** UID usado nas escritas Firestore — sempre a conta de dados da sessão autenticada. */
function resolveFirestoreWriteUid(entryOwnerUid: string): string {
  const dataOwner = getCachedDataOwnerUid();
  const loginUid = getCachedLoginUid();
  if (dataOwner?.trim()) return dataOwner.trim();
  if (loginUid?.trim()) return loginUid.trim();
  if (entryOwnerUid && entryOwnerUid !== ANONYMOUS_OWNER) return entryOwnerUid;
  throw new Error('Sessão não autenticada para envio à nuvem.');
}

/** Unifica pendências locais (__local__ / fila órfã) na conta logada antes do upload. */
async function reconcileSessionPendingOwner(targetOwnerUid: string): Promise<void> {
  if (!targetOwnerUid.trim()) return;
  await migrateAnonymousDexieToOwner(targetOwnerUid);
  await syncQueue.reassignPendingOwner([ANONYMOUS_OWNER], targetOwnerUid);
}

/** Envia aplicadores locais que ainda não existem na nuvem (ex.: cadastrados antes da sync). */
async function enqueueLocalAplicadoresMissingFromRemote(ownerUid: string): Promise<void> {
  const loginUid = getCachedLoginUid();
  if (!loginUid || loginUid !== ownerUid) return;

  const [local, remote] = await Promise.all([
    listAplicadores(ownerUid),
    getAllAplicadoresFirestore(ownerUid),
  ]);
  const remoteIds = new Set(remote.map((a) => a.id));

  for (const row of local) {
    if (row.deleted || remoteIds.has(row.id) || row.syncStatus === 'pending') continue;
    const pending = { ...row, syncStatus: 'pending' as const };
    await putAplicadorRecord(pending);
    await syncQueue.enqueue({
      operationType: 'CREATE',
      collection: 'aplicadores',
      documentId: row.id,
      payload: pending,
      ownerUid,
    });
  }
}

/** Coloca na fila registros Dexie marcados como pending que ainda não estão na fila. */
async function enqueueDexiePendingIntoQueue(ownerUid: string): Promise<void> {
  const summary = await getPendingSyncItems(ownerUid);
  if (summary.total === 0) return;

  const queueItems = await syncQueue.listPending(ownerUid);
  const queued = new Set(queueItems.map((q) => `${q.collection}:${q.documentId}`));

  for (const item of summary.items) {
    const key = `${item.collection}:${item.id}`;
    if (queued.has(key)) continue;
    const isDelete = item.record.deleted === true;
    const isNew =
      !isDelete &&
      item.record.version === 1 &&
      item.record.createdAt === item.record.updatedAt;
    await syncQueue.enqueue({
      operationType: isDelete ? 'DELETE' : isNew ? 'CREATE' : 'UPDATE',
      collection: item.collection,
      documentId: item.id,
      payload: item.record,
      ownerUid,
    });
    queued.add(key);
  }
}

async function executeQueueItem(entry: SyncQueueEntry): Promise<void> {
  const uid = resolveFirestoreWriteUid(entry.ownerUid);
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

  if (entry.collection === 'aplicadores') {
    if (entry.operationType === 'DELETE') {
      await deleteAplicadorFirestore(uid, entry.documentId);
      const dbApp = await listAplicadores(uid, true);
      const row = dbApp.find((a) => a.id === entry.documentId);
      if (row) await putAplicadorRecord({ ...row, syncStatus: 'synced' });
      return;
    }
    
    const appPayload = payload as AplicadorItemPersist;
    if (!appPayload.id) {
      appPayload.id = entry.documentId || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    await addAplicadorFirestore(uid, appPayload);
    const savedApp = payload as AplicadorRecord;
    await putAplicadorRecord({ ...savedApp, ownerUid: uid, syncStatus: 'synced' });
    return;
  }

  if (entry.operationType === 'DELETE') {
    await deleteSessaoFirestore(uid, entry.documentId);
    const dbSess = await listSessoes(uid, true);
    const row = dbSess.find((s) => s.id === entry.documentId);
    if (row) await putSessaoRecord({ ...row, syncStatus: 'synced' });
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
  /** Modo online ativo: tempo real ligado, sem sync periódico. */
  isOnlineModeActive(): boolean {
    return (
      ownerUid != null &&
      onlineModeUid === ownerUid &&
      systemState.canUseFirebase() &&
      !systemState.isForcedOffline()
    );
  }

  /** Garante ownerUid antes de sync disparado pelo OfflineSyncContext. */
  bindOwner(dataOwnerUid: string): void {
    ownerUid = dataOwnerUid;
  }

  async init(dataOwnerUid: string): Promise<void> {
    ownerUid = dataOwnerUid;
    await systemState.hydrate();
    await getMeta(`migrated:${dataOwnerUid}`);
    connectivityMonitor.start();
    stopRealtimeSync();
    onlineModeUid = null;

    connectivityUnsub?.();
    connectivityUnsub = null;

    notify();
  }

  /** Envia pendentes, baixa snapshot da nuvem e liga tempo real. */
  async connectOnlineFromCloud(): Promise<void> {
    if (!ownerUid || systemState.isForcedOffline()) {
      confirmCloudDisplayReady();
      return;
    }
    if (!connectivityMonitor.canSync()) {
      confirmCloudDisplayReady();
      return;
    }

    try {
      await systemState.setOnlineActive();
      await withTimeout(this.cacheCloudSnapshotLocally(), CLOUD_PULL_TIMEOUT_MS, 'pull');
      await this.enableOnlineMode(true);
    } catch (error) {
      await syncLogger.error(
        'sync',
        error instanceof Error ? error.message : String(error),
      );
      try {
        await this.enableOnlineMode(true);
      } catch {
        // Tempo real indisponível — libera UI mesmo assim.
      }
      setCloudSyncResult(false);
    } finally {
      confirmCloudDisplayReady();
      notify();
    }
  }

  /** Copia snapshot da nuvem para o IndexedDB (respeita registros locais pendentes). */
  async cacheCloudSnapshotLocally(): Promise<void> {
    if (!ownerUid || !connectivityMonitor.canSync() || !systemState.canUseFirebase()) return;
    await this.pullFromRemote(true);
  }

  /** Liga tempo real uma vez e garante cache local completo da nuvem. */
  async enableOnlineMode(skipPull = false): Promise<void> {
    if (!ownerUid || systemState.isForcedOffline()) return;

    const alreadyListening = onlineModeUid === ownerUid;
    if (!skipPull && connectivityMonitor.canSync()) {
      await this.cacheCloudSnapshotLocally();
    }
    if (alreadyListening) return;

    stopRealtimeSync();
    startRealtimeSync(ownerUid, () => notify());
    onlineModeUid = ownerUid;
  }

  /** Desliga tempo real (ex.: modo offline controlado). */
  deactivateOnlineMode(): void {
    stopRealtimeSync();
    onlineModeUid = null;
  }

  /** Unifica pendências locais antes de contar ou enviar. */
  async preparePendingOwner(dataOwnerUid: string): Promise<void> {
    await reconcileSessionPendingOwner(dataOwnerUid);
  }

  /**
   * Envia apenas pendentes (upload idempotente via fila).
   * Não faz pull até confirmação de escrita.
   */
  async uploadPendingOnly(): Promise<{ success: boolean; error?: string }> {
    if (!ownerUid) return { success: false, error: 'no_owner' };

    const loginUid = await waitForAuthenticatedUid(8000);
    if (!loginUid) {
      return { success: false, error: 'Sessão expirada. Saia e entre novamente com Google.' };
    }

    await connectivityMonitor.refresh();
    const browserOnline =
      typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!browserOnline && !connectivityMonitor.canSync()) {
      return { success: false, error: 'offline' };
    }

    lastProcessFinishedAt = 0;
    await reconcileSessionPendingOwner(ownerUid);
    await syncQueue.resetFailedToPending(ownerUid);

    for (let round = 0; round < 4; round++) {
      await enqueueDexiePendingIntoQueue(ownerUid);
      const queuePending = await syncQueue.listPending(ownerUid);
      if (queuePending.length === 0) {
        const stillEmpty = await getPendingSyncItems(ownerUid);
        if (stillEmpty.total === 0) {
          await syncQueue.clearDone(ownerUid);
          return { success: true };
        }
        continue;
      }

      const uploaded = await this.runForcedUpload();
      if (!uploaded) {
        const queueError = await syncQueue.getLatestError(ownerUid);
        return { success: false, error: queueError ?? 'upload_failed' };
      }

      const still = await getPendingSyncItems(ownerUid);
      if (still.total === 0) {
        await syncQueue.clearDone(ownerUid);
        return { success: true };
      }
    }

    const still = await getPendingSyncItems(ownerUid);
    if (still.total === 0) {
      await syncQueue.clearDone(ownerUid);
      return { success: true };
    }
    const queueError = await syncQueue.getLatestError(ownerUid);
    return { success: false, error: queueError ?? 'pending_remain' };
  }

  private async runForcedUpload(): Promise<boolean> {
    const ok = await this.processQueue({ uploadOnly: true, bypassGap: true, forceUpload: true });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 250));
    return this.processQueue({ uploadOnly: true, bypassGap: true, forceUpload: true });
  }

  shutdown(): void {
    stopRealtimeSync();
    connectivityUnsub?.();
    connectivityUnsub = null;
    ownerUid = null;
    onlineModeUid = null;
    if (processTimer) clearTimeout(processTimer);
    processTimer = null;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
  }

  subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Enfileira upload imediato das alterações locais (conta logada + online). */
  scheduleRealtimeFlush(): void {
    if (!ownerUid || !getCachedLoginUid()) return;
    if (!connectivityMonitor.canSync() || systemState.isForcedOffline()) return;

    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void this.flushPendingOnChange();
    }, REALTIME_FLUSH_MS);
  }

  /** Envia pendentes para a nuvem sem pull — uso após cada mutação local. */
  async flushPendingOnChange(): Promise<void> {
    if (!ownerUid || !getCachedLoginUid()) return;
    if (!connectivityMonitor.canSync() || systemState.isForcedOffline()) return;

    if (processing) {
      this.scheduleRealtimeFlush();
      return;
    }

    await enqueueDexiePendingIntoQueue(ownerUid);
    const queuePending = await syncQueue.listPending(ownerUid);
    if (queuePending.length === 0) return;

    await this.processQueue({ uploadOnly: true, bypassGap: true, forceUpload: true });
  }

  scheduleProcess(immediate = false): Promise<void> {
    if (!ownerUid || systemState.isForcedOffline()) return Promise.resolve();
    if (processTimer) clearTimeout(processTimer);
    const delay =
      immediate || this.isOnlineModeActive() || getCachedLoginUid() != null ? 50 : 800;
    return new Promise((resolve) => {
      processTimer = setTimeout(() => {
        void this.processQueue().finally(() => resolve());
      }, delay);
    });
  }

  private currentProcessPromise: Promise<boolean> | null = null;

  async processQueue(options?: {
    uploadOnly?: boolean;
    bypassGap?: boolean;
    forceUpload?: boolean;
  }): Promise<boolean> {
    if (!ownerUid) return false;
    const browserOnline =
      typeof navigator === 'undefined' || navigator.onLine !== false;
    if (options?.forceUpload) {
      if (!browserOnline) return false;
    } else if (!connectivityMonitor.canSync()) {
      return false;
    }
    if (systemState.isForcedOffline() && !options?.forceUpload) return false;
    if (
      !options?.bypassGap &&
      !this.isOnlineModeActive() &&
      Date.now() - lastProcessFinishedAt < MIN_PROCESS_GAP_MS
    ) {
      return false;
    }

    if (this.currentProcessPromise) {
      return this.currentProcessPromise;
    }

    this.currentProcessPromise = (async () => {
      processing = true;
      connectivityMonitor.setSyncing(true);
      beginCloudSync();
      setSyncProgress(10);

      try {
        const pending = await syncQueue.listPending(ownerUid!);
        setSyncProgress(25);

        for (let i = 0; i < pending.length; i++) {
          const item = pending[i]!;
          await syncQueue.markProcessing(item.operationId);
          try {
            await withCloudUpload(() => executeQueueItem(item));
            await syncQueue.markDone(item.operationId);
            setSyncProgress(25 + Math.round(((i + 1) / Math.max(pending.length, 1)) * 40));
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await syncQueue.markFailed(item.operationId, msg, item.retries + 1);
            await syncLogger.error('queue', msg, { operationId: item.operationId });
            // Pequeno delay para não travar a CPU em caso de loop de erros, mas sem fazer o usuário esperar minutos
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        setSyncProgress(70);
        if (!options?.uploadOnly && systemState.canUseFirebase()) {
          const stillPending = await getPendingSyncItems(ownerUid!);
          const queueLeft = await syncQueue.listPending(ownerUid!);
          if (stillPending.total === 0 && queueLeft.length === 0) {
            await this.pullFromRemote(false);
          }
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
        this.currentProcessPromise = null;
      }
    })();

    return this.currentProcessPromise;
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

    await applyTeamWipeIfNeeded(ownerUid, getCachedLoginUid());

    const [remoteCadastros, remoteSessoes, remoteAplicadores] = await Promise.all([
      getAllCadastrosFirestoreLight(ownerUid),
      getAllSessoesFirestoreLight(ownerUid),
      getAllAplicadoresFirestore(ownerUid),
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

    for (const app of remoteAplicadores) {
      await applyRemoteAplicador(
        {
          ...app,
          ownerUid,
          version: 1,
          syncStatus: 'synced',
          deleted: false,
          deviceId: 'remote',
          userId: getCachedLoginUid(),
          createdAt: app.updatedAt ?? Date.now(),
          lastModifiedBy: 'remote',
        },
        ownerUid,
      );
    }

    await enqueueLocalAplicadoresMissingFromRemote(ownerUid);

    lastPullAt = Date.now();
    await setMeta(`lastPull:${ownerUid}`, String(lastPullAt));
    setCloudSyncResult(true);
    await syncLogger.info(
      'sync',
      `Pull concluído: ${remoteCadastros.length} cadastros, ${remoteSessoes.length} sessões, ${remoteAplicadores.length} aplicadores`,
    );
    notify();
    void this.scheduleProcess(true);
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
  void import('./SyncManager').then(({ syncManager }) => {
    syncManager.scheduleOnlineWriteFlush();
  });
}

export function subscribeDataChanged(listener: StoreListener): () => void {
  return syncEngine.subscribe(listener);
}
