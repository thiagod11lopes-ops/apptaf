import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import {
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
  getAllCadastrosFirestoreLight,
  getCadastrosFirestoreSince,
  addAplicadorFirestore,
  deleteAplicadorFirestore,
  getAllAplicadoresFirestore,
  getAplicadoresFirestoreSince,
  addSessaoFirestore,
  deleteSessaoFirestore,
  getAllSessoesFirestoreLight,
  getSessoesFirestoreSince,
  updateSessaoFirestore,
  wipeAllCloudDataForOwner,
} from './firebase/FirebaseGateway';
import { getCachedLoginUid, getCachedDataOwnerUid, waitForAuthenticatedUid } from '../../services/firebase/authUid';
import type { WipeCloudProgressCallback } from '../../services/firebase/wipeCloudDataFirestore';
import { applyTeamWipeIfNeeded } from './syncTeamWipe';
import { pushPendingAuthorizedEmails } from './syncAuthorizedEmails';
import { getRemoteSyncWatermark } from './syncWatermark';
import { INCREMENTAL_SINCE_MARGIN_MS } from './remoteSnapshotCache';
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
  getCadastroRaw,
  getAplicadorRaw,
  getSessaoRaw,
} from '../db/localDb';
import { getMeta, setMeta } from '../db/tafDatabase';
import { syncQueue } from './SyncQueue';
import { syncLogger } from './SyncLogger';
import { connectivityMonitor } from './ConnectivityMonitor';
import { systemState } from './SystemState';
import { getPendingSyncItems } from './pendingSyncItems';
import { isUnsyncedLocalStatus } from './syncStatus';
import { markRecordSynced, readSyncVersion } from './recordMeta';
import { isQueuePayloadStillCurrent } from './queueSyncGuard';
import { buildFirestoreTombstone } from './tombstone';
import {
  executeLastWriteWinsSync,
  stripForCloud,
  type LwwSyncStats,
  type SyncProgressCallback,
} from './lastWriteWinsSync';
import {
  beginCloudSync,
  endCloudSync,
  setCloudSyncResult,
  setSyncProgress,
  withCloudUpload,
} from '../../services/offline/cloudSyncActivity';
import { confirmCloudDisplayReady } from './cloudDisplayGate';
import { migrateAnonymousDexieToOwner, migrateDexieOwnerToOwner } from '../db/migration';
import {
  isAuthorizedMemberSession,
  isMemberAplicadorSenhaChange,
  toAplicadorFirestorePayload,
} from '../../utils/aplicadorSyncPolicy';

type StoreListener = () => void;

let ownerUid: string | null = null;
let onlineModeUid: string | null = null;
let processing = false;
let processTimer: ReturnType<typeof setTimeout> | null = null;
let connectivityUnsub: (() => void) | null = null;
let listeners = new Set<StoreListener>();
let lastPullAt = 0;
const MIN_PULL_MS = 45_000;
const MIN_PROCESS_GAP_MS = 12_000;
const CLOUD_PULL_TIMEOUT_MS = 35_000;
let lastProcessFinishedAt = 0;

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

/** UID usado nas escritas Firestore — sempre a conta de dados da sessão autenticada. */
function resolveFirestoreWriteUid(entryOwnerUid: string): string {
  const dataOwner = getCachedDataOwnerUid();
  const loginUid = getCachedLoginUid();
  if (dataOwner?.trim()) return dataOwner.trim();
  if (loginUid?.trim()) return loginUid.trim();
  if (entryOwnerUid && entryOwnerUid !== ANONYMOUS_OWNER) return entryOwnerUid;
  throw new Error('Sessão não autenticada para envio à nuvem.');
}

/** Unifica pendências locais (__local__ / UID do membro / fila órfã) na conta do chefe antes do upload. */
async function reconcileSessionPendingOwner(targetOwnerUid: string): Promise<void> {
  if (!targetOwnerUid.trim()) return;
  const loginUid = getCachedLoginUid();
  await migrateAnonymousDexieToOwner(targetOwnerUid);
  if (loginUid && loginUid !== targetOwnerUid) {
    await migrateDexieOwnerToOwner(loginUid, targetOwnerUid);
  }
  const fromOwners = [ANONYMOUS_OWNER];
  if (loginUid && loginUid !== targetOwnerUid) {
    fromOwners.push(loginUid);
  }
  await syncQueue.reassignPendingOwner(fromOwners, targetOwnerUid);
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
    if (row.deleted || remoteIds.has(row.id) || isUnsyncedLocalStatus(row.syncStatus)) continue;
    const pending = { ...row, syncStatus: 'updated' as const };
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

/** Loga confirmação ignorada por edição concorrente (registro segue pendente). */
async function logStaleQueueConfirm(entry: SyncQueueEntry, id: string): Promise<void> {
  await syncLogger.info(
    'queue',
    `Confirmação ignorada: ${entry.collection}/${id} foi editado durante o upload — permanece pendente`,
    { operationId: entry.operationId },
  );
}

/**
 * Executor unificado (7.2/7.3): Dexie fresh é a fonte do payload.
 * `entry.payload` é apenas hint (ex.: batch legado). Version guard antes/depois do write.
 */
async function executeQueueItem(entry: SyncQueueEntry): Promise<void> {
  const uid = resolveFirestoreWriteUid(entry.ownerUid);

  // Batch legado: reenvia cada ID a partir do Dexie atual (não do JSON congelado).
  if (entry.collection === 'cadastros') {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(entry.payload) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    if (parsed.kind === 'cadastrosBatch' && Array.isArray(parsed.items)) {
      const ids = (parsed.items as Array<{ id?: string }>)
        .map((i) => i.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      for (const id of ids) {
        await executeQueueItem({
          ...entry,
          operationId: entry.operationId,
          documentId: id,
          operationType: 'UPDATE',
          payload: '{}',
        });
      }
      return;
    }
  }

  if (entry.collection === 'cadastros') {
    const row = await getCadastroRaw(entry.documentId);
    if (!row) return;
    const sentVersion = readSyncVersion(row);

    if (row.deleted) {
      await deleteCadastroFirestore(uid, entry.documentId, buildFirestoreTombstone(row));
    } else {
      // Abort pré-write se a versão mudou entre claim e leitura (raro).
      const still = await getCadastroRaw(entry.documentId);
      if (!still || readSyncVersion(still) !== sentVersion) {
        await logStaleQueueConfirm(entry, entry.documentId);
        return;
      }
      await addCadastroFirestore(
        uid,
        stripForCloud({ ...still, ownerUid: uid } as unknown as Record<string, unknown>) as unknown as CadastroItemPersist,
      );
    }

    if (!(await isQueuePayloadStillCurrent('cadastros', entry.documentId, { syncVersion: sentVersion }))) {
      await logStaleQueueConfirm(entry, entry.documentId);
      return;
    }
    const fresh = await getCadastroRaw(entry.documentId);
    if (fresh) {
      await putCadastroRecord(markRecordSynced({ ...fresh, ownerUid: uid }, getCachedLoginUid()));
    }
    return;
  }

  if (entry.collection === 'aplicadores') {
    const row = await getAplicadorRaw(entry.documentId);
    if (!row) return;

    if (isAuthorizedMemberSession() && !row.deleted) {
      // Membros só sobem troca de senha — alinhado ao LWW.
      if (!isMemberAplicadorSenhaChange(row, undefined)) {
        await syncLogger.info('queue', 'aplicador_upload_ignorado_membro', {
          operationId: entry.operationId,
          collection: 'aplicadores',
        });
        return;
      }
    }

    const sentVersion = readSyncVersion(row);
    if (row.deleted) {
      await deleteAplicadorFirestore(uid, entry.documentId, buildFirestoreTombstone(row));
    } else {
      const still = await getAplicadorRaw(entry.documentId);
      if (!still || readSyncVersion(still) !== sentVersion) {
        await logStaleQueueConfirm(entry, entry.documentId);
        return;
      }
      await addAplicadorFirestore(
        uid,
        toAplicadorFirestorePayload(
          stripForCloud({ ...still, ownerUid: uid } as unknown as Record<string, unknown>) as unknown as AplicadorItemPersist,
        ),
      );
    }

    if (!(await isQueuePayloadStillCurrent('aplicadores', entry.documentId, { syncVersion: sentVersion }))) {
      await logStaleQueueConfirm(entry, entry.documentId);
      return;
    }
    const fresh = await getAplicadorRaw(entry.documentId);
    if (fresh) {
      await putAplicadorRecord(markRecordSynced({ ...fresh, ownerUid: uid }, getCachedLoginUid()));
    }
    return;
  }

  // sessoes
  const row = await getSessaoRaw(entry.documentId);
  if (!row) return;
  const sentVersion = readSyncVersion(row);

  if (row.deleted) {
    await deleteSessaoFirestore(uid, entry.documentId, buildFirestoreTombstone(row));
  } else {
    const still = await getSessaoRaw(entry.documentId);
    if (!still || readSyncVersion(still) !== sentVersion) {
      await logStaleQueueConfirm(entry, entry.documentId);
      return;
    }
    const sessao = stripForCloud({ ...still, ownerUid: uid } as unknown as Record<string, unknown>) as unknown as SessaoAplicacaoTaf;
    if (entry.operationType === 'CREATE') {
      await addSessaoFirestore(uid, sessao);
    } else {
      await updateSessaoFirestore(uid, sessao);
    }
  }

  if (!(await isQueuePayloadStillCurrent('sessoes', entry.documentId, { syncVersion: sentVersion }))) {
    await logStaleQueueConfirm(entry, entry.documentId);
    return;
  }
  const fresh = await getSessaoRaw(entry.documentId);
  if (fresh) {
    await putSessaoRecord(markRecordSynced({ ...fresh, ownerUid: uid }, getCachedLoginUid()));
  }
}

export class SyncEngine {
  /** Modo online ativo apenas durante sync manual. */
  isOnlineModeActive(): boolean {
    return (
      ownerUid != null &&
      onlineModeUid === ownerUid &&
      systemState.canUseFirebase()
    );
  }

  /** Garante ownerUid antes de sync disparado pelo OfflineSyncContext. */
  bindOwner(dataOwnerUid: string): void {
    ownerUid = dataOwnerUid;
  }

  async init(dataOwnerUid: string, opts?: { preserveOnlineMode?: boolean }): Promise<void> {
    ownerUid = dataOwnerUid;
    if (!opts?.preserveOnlineMode) {
      await systemState.hydrate();
    }
    await getMeta(`migrated:${dataOwnerUid}`);
    // Crash recovery: processing órfão volta a pending após lease.
    await syncQueue.recoverStaleProcessing(dataOwnerUid);
    connectivityMonitor.start();
    onlineModeUid = dataOwnerUid;

    connectivityUnsub?.();
    connectivityUnsub = null;

    notify();
  }

  /** Encerra sessão online sem apagar ownerUid local. */
  async shutdownSession(): Promise<void> {
    onlineModeUid = null;
    if (processTimer) clearTimeout(processTimer);
    processTimer = null;
    notify();
  }

  /** @deprecated sync manual — use uploadPendingOnly + pullFromRemote */
  async connectOnlineFromCloud(): Promise<void> {
    if (!ownerUid || !connectivityMonitor.canSync() || !systemState.canUseFirebase()) {
      confirmCloudDisplayReady();
      return;
    }
    try {
      await withTimeout(this.cacheCloudSnapshotLocally(), CLOUD_PULL_TIMEOUT_MS, 'pull');
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

  /** @deprecated tempo real removido */
  async enableOnlineMode(skipPull = false): Promise<void> {
    if (!ownerUid) return;
    if (!skipPull && connectivityMonitor.canSync() && systemState.canUseFirebase()) {
      await this.cacheCloudSnapshotLocally();
    }
    onlineModeUid = ownerUid;
  }

  deactivateOnlineMode(): void {
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
    await syncQueue.recoverStaleProcessing(ownerUid);
    await syncQueue.resetFailedToPending(ownerUid);

    // E-mails autorizados pendentes não passam pela SyncQueue — envia antes
    // para que o total de pendências possa zerar.
    await pushPendingAuthorizedEmails(ownerUid);

    for (let round = 0; round < 4; round++) {
      await enqueueDexiePendingIntoQueue(ownerUid);
      const queuePending = await syncQueue.listReady(ownerUid);
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
    connectivityUnsub?.();
    connectivityUnsub = null;
    ownerUid = null;
    onlineModeUid = null;
    if (processTimer) clearTimeout(processTimer);
    processTimer = null;
  }

  subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** @deprecated sync manual — mutações locais não disparam upload automático */
  scheduleRealtimeFlush(): void {}

  /** @deprecated sync manual */
  async flushPendingOnChange(): Promise<void> {
    return;
  }

  scheduleProcess(immediate = false): Promise<void> {
    if (!ownerUid) return Promise.resolve();
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
        // Recovery + só itens com backoff vencido.
        const pending = await syncQueue.listReady(ownerUid!);
        setSyncProgress(25);

        let succeeded = 0;
        let failed = 0;

        for (let i = 0; i < pending.length; i++) {
          const item = pending[i]!;
          const claimed = await syncQueue.claimForProcessing(item.operationId);
          if (!claimed) continue;
          try {
            await withCloudUpload(() => executeQueueItem(claimed));
            await syncQueue.markDone(claimed.operationId, claimed.attemptId);
            succeeded += 1;
            setSyncProgress(25 + Math.round(((i + 1) / Math.max(pending.length, 1)) * 40));
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await syncQueue.markFailed(
              claimed.operationId,
              msg,
              claimed.retries + 1,
              claimed.attemptId,
            );
            failed += 1;
            await syncLogger.error('queue', msg, {
              operationId: claimed.operationId,
              collection: claimed.collection,
              retries: claimed.retries + 1,
            });
          }
        }

        setSyncProgress(70);
        if (!options?.uploadOnly && systemState.canUseFirebase()) {
          await pushPendingAuthorizedEmails(ownerUid!);
          // Pull legado desabilitado aqui — o LWW (SyncManager) é a fonte da verdade
          // para download/tombstones. Evita ressurreição com deleted:false forçado.
        }
        setSyncProgress(100);
        const queueOk = failed === 0 && (succeeded > 0 || pending.length === 0);
        setCloudSyncResult(queueOk);
        notify();
        return queueOk;
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

  /**
   * Pull legado — aplica apenas registros ativos via LWW local (`applyRemote*`).
   * Não força `deleted: false` sobre dados que já expressam exclusão.
   * Tombstones completos ficam a cargo do LWW em `executeLastWriteWinsSync`.
   */
  async pullFromRemote(force = false): Promise<void> {
    if (!ownerUid || !connectivityMonitor.canSync() || !systemState.canUseFirebase()) return;
    if (!force && Date.now() - lastPullAt < MIN_PULL_MS) return;

    await applyTeamWipeIfNeeded(ownerUid, getCachedLoginUid());

    const watermark = await getRemoteSyncWatermark(ownerUid);
    const since =
      watermark != null && watermark > 0
        ? Math.max(0, watermark - INCREMENTAL_SINCE_MARGIN_MS)
        : null;

    const [remoteCadastros, remoteSessoes, remoteAplicadores] = await Promise.all(
      since != null
        ? [
            getCadastrosFirestoreSince(ownerUid, since),
            getSessoesFirestoreSince(ownerUid, since),
            getAplicadoresFirestoreSince(ownerUid, since),
          ]
        : [
            getAllCadastrosFirestoreLight(ownerUid),
            getAllSessoesFirestoreLight(ownerUid),
            getAllAplicadoresFirestore(ownerUid),
          ],
    );

    for (const cad of remoteCadastros) {
      const remoteDeleted = (cad as { deleted?: boolean }).deleted === true;
      await applyRemoteCadastro(
        {
          ...cad,
          ownerUid,
          version: 1,
          syncStatus: 'synced',
          deleted: remoteDeleted,
          deviceId: 'remote',
          userId: getCachedLoginUid(),
          createdAt: cad.updatedAt ?? Date.now(),
          lastModifiedBy: 'remote',
        },
        ownerUid,
      );
    }

    for (const sess of remoteSessoes) {
      const remoteDeleted = (sess as { deleted?: boolean }).deleted === true;
      await applyRemoteSessao(
        {
          ...sess,
          ownerUid,
          version: 1,
          syncStatus: 'synced',
          deleted: remoteDeleted,
          deviceId: 'remote',
          userId: getCachedLoginUid(),
          createdAt: Date.parse(sess.criadoEm) || Date.now(),
          lastModifiedBy: 'remote',
        },
        ownerUid,
      );
    }

    for (const app of remoteAplicadores) {
      const remoteDeleted = (app as { deleted?: boolean }).deleted === true;
      await applyRemoteAplicador(
        {
          ...app,
          ownerUid,
          version: 1,
          syncStatus: 'synced',
          deleted: remoteDeleted,
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
      `Pull ${since != null ? 'incremental' : 'completo'}: ${remoteCadastros.length} cadastros, ${remoteSessoes.length} sessões, ${remoteAplicadores.length} aplicadores`,
    );
    notify();
    void this.scheduleProcess(true);
  }

  async forceSync(): Promise<void> {
    if (!ownerUid) return;
    lastPullAt = 0;
    lastProcessFinishedAt = 0;
    await syncQueue.recoverStaleProcessing(ownerUid);
    await syncQueue.resetFailedToPending(ownerUid);
    await this.processQueue({ bypassGap: true });
  }

  async runLastWriteWinsSync(options?: {
    backupId?: number | null;
    clockDrift?: import('./clockDrift').ClockDriftResult;
    userEmail?: string | null;
    onProgress?: SyncProgressCallback;
  }): Promise<{
    success: boolean;
    stats: LwwSyncStats;
    audit: import('./syncAudit').SyncAuditEntry;
    alreadyUpToDate: boolean;
    plannedUploads: number;
    plannedDownloads: number;
  }> {
    if (!ownerUid) {
      return {
        success: false,
        stats: { uploads: 0, downloads: 0, ignored: 0, errors: ['no_owner'] },
        alreadyUpToDate: false,
        plannedUploads: 0,
        plannedDownloads: 0,
        audit: {
          ownerUid: '',
          userId: null,
          deviceId: 'unknown',
          startedAt: Date.now(),
          finishedAt: Date.now(),
          durationMs: 0,
          uploads: 0,
          downloads: 0,
          ignored: 0,
          failures: 1,
          errors: ['no_owner'],
          result: 'FAILED',
          strategy: 'last_write_wins',
        },
      };
    }
    await reconcileSessionPendingOwner(ownerUid);
    const result = await executeLastWriteWinsSync(ownerUid, options);
    notify();
    return result;
  }

  async getPendingCount(): Promise<number> {
    if (!ownerUid) return 0;
    return syncQueue.countPending(ownerUid);
  }

  /** Wipe na nuvem — somente via Sync Engine (FirebaseGateway). */
  async wipeCloudTeam(uid: string, onProgress?: WipeCloudProgressCallback) {
    if (!systemState.canUseFirebase()) {
      throw new Error('Ative o modo de sincronização para apagar dados na nuvem.');
    }
    return wipeAllCloudDataForOwner(uid, onProgress);
  }
}

export const syncEngine = new SyncEngine();

/** Notifica ouvintes após mutação local (sem sync automático). */
export function notifyDataChanged(): void {
  notify();
}

export function subscribeDataChanged(listener: StoreListener): () => void {
  return syncEngine.subscribe(listener);
}
