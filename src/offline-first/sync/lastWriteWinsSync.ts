import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import {
  getAllCadastrosFirestoreLight,
  addCadastroFirestore,
  deleteCadastroFirestore,
} from './firebase/FirebaseGateway';
import {
  getAllAplicadoresFirestore,
  addAplicadorFirestore,
  deleteAplicadorFirestore,
} from './firebase/FirebaseGateway';
import {
  getAllSessoesFirestoreLight,
  addSessaoFirestore,
  updateSessaoFirestore,
  deleteSessaoFirestore,
} from './firebase/FirebaseGateway';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { getDeviceId } from '../deviceId';
import type { AplicadorRecord, CadastroRecord, CollectionName, SessaoRecord } from '../types';
import {
  listAplicadoresForSync,
  listCadastrosForSync,
  listSessoesForSync,
  putAplicadorRecord,
  putCadastroRecord,
  putSessaoRecord,
} from '../db/localDb';
import { migrateDeviceDataOnLogin } from '../db/migration';
import { decideLastWriteWins, type LwwAction, type SyncRecord } from './lastWriteWins';
import { markRecordSynced } from './recordMeta';
import { isUnsyncedLocalStatus } from './syncStatus';
import { appendSyncAudit, type SyncAuditEntry } from './syncAudit';
import { syncQueue } from './SyncQueue';
import { pushPendingAuthorizedEmails } from './syncAuthorizedEmails';
import { APP_VERSION } from '../appVersion';
import type { ClockDriftResult } from './clockDrift';
import {
  buildFirestoreTombstone,
  remoteDocToSyncRecord,
  type DeletionAuditEntry,
} from './tombstone';
import {
  buildDeletionAuditEntry,
  runDeletionGarbageCollection,
} from './deletionGarbageCollection';
import type { SyncStepId } from './syncSteps';
import { getPendingSyncItems } from './pendingSyncItems';

export type LwwSyncStats = {
  uploads: number;
  downloads: number;
  ignored: number;
  errors: string[];
};

export type SyncProgressCallback = (update: {
  processed: number;
  total: number;
  message: string;
  stepId?: SyncStepId;
  pendingUploads?: number;
  pendingDownloads?: number;
  phase?: 'compare' | 'upload' | 'download' | 'finalize';
}) => void;

type PlannedSyncItem = {
  collection: CollectionName;
  id: string;
  action: LwwAction;
  local?: SyncRecord;
  remote?: SyncRecord;
  hasRemote: boolean;
};

function stripForFirestore<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  for (const key of [
    'ownerUid',
    'syncStatus',
    'syncVersion',
    'lastSync',
    'updatedBy',
    'deviceId',
    'userId',
    'version',
    'deleted',
    'deletedAt',
    'deletedBy',
    'lastModifiedBy',
    'createdAt',
  ]) {
    delete copy[key];
  }
  return copy as T;
}

function remoteToCadastroRecord(remote: CadastroItemPersist, ownerUid: string): CadastroRecord {
  return remoteDocToSyncRecord<CadastroRecord>(remote as Record<string, unknown> & { id: string }, ownerUid);
}

function remoteToSessaoRecord(remote: SessaoAplicacaoTaf, ownerUid: string): SessaoRecord {
  return remoteDocToSyncRecord<SessaoRecord>(remote as Record<string, unknown> & { id: string }, ownerUid);
}

function remoteToAplicadorRecord(remote: AplicadorItemPersist, ownerUid: string): AplicadorRecord {
  return remoteDocToSyncRecord<AplicadorRecord>(remote as Record<string, unknown> & { id: string }, ownerUid);
}

function countIds(local: SyncRecord[], remote: { id: string }[]): number {
  const ids = new Set([...local.map((r) => r.id), ...remote.map((r) => r.id)]);
  return ids.size;
}

function buildSyncPlan<TLocal extends SyncRecord, TRemote extends { id: string }>(
  collection: CollectionName,
  ownerUid: string,
  localRows: TLocal[],
  remoteRows: TRemote[],
  toRecord: (remote: TRemote, ownerUid: string) => SyncRecord,
): { plan: PlannedSyncItem[]; ignored: number } {
  const localMap = new Map(localRows.map((r) => [r.id, r]));
  const remoteMap = new Map(remoteRows.map((r) => [r.id, toRecord(r, ownerUid)]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const plan: PlannedSyncItem[] = [];
  let ignored = 0;

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    const hasRemote = remoteMap.has(id);
    const decision = decideLastWriteWins(local, remote);

    if (decision.action === 'skip') {
      ignored += 1;
      continue;
    }

    plan.push({
      collection,
      id,
      action: decision.action,
      local,
      remote,
      hasRemote,
    });
  }

  return { plan, ignored };
}

/** Alinha syncStatus local quando LWW ignora registro já idêntico ao remoto. */
async function reconcileIdenticalUnsyncedLocals<TLocal extends SyncRecord, TRemote extends { id: string }>(
  collection: CollectionName,
  ownerUid: string,
  localRows: TLocal[],
  remoteRows: TRemote[],
  toRecord: (remote: TRemote, ownerUid: string) => SyncRecord,
): Promise<number> {
  const remoteMap = new Map(remoteRows.map((r) => [r.id, toRecord(r, ownerUid)]));
  const loginUid = getCachedLoginUid();
  let reconciled = 0;

  for (const local of localRows) {
    if (!isUnsyncedLocalStatus(local.syncStatus)) continue;
    const remote = remoteMap.get(local.id);
    if (!remote) continue;
    const decision = decideLastWriteWins(local, remote);
    if (decision.action !== 'skip') continue;

    const merged = markRecordSynced({ ...local, ownerUid }, loginUid);
    if (collection === 'cadastros') {
      await putCadastroRecord(merged as CadastroRecord);
    } else if (collection === 'sessoes') {
      await putSessaoRecord(merged as SessaoRecord);
    } else {
      await putAplicadorRecord(merged as AplicadorRecord);
    }
    reconciled += 1;
  }

  return reconciled;
}

async function flushRemainingPendingRecords(
  ownerUid: string,
  remoteCad: CadastroItemPersist[],
  remoteSess: SessaoAplicacaoTaf[],
  remoteApp: AplicadorItemPersist[],
  uploadFns: Record<CollectionName, UploadFn>,
  stats: LwwSyncStats,
  deletionAudits: DeletionAuditEntry[],
  progressCb?: SyncProgressCallback,
): Promise<void> {
  const pending = await getPendingSyncItems(ownerUid);
  if (pending.total === 0) return;

  progressCb?.({
    processed: 0,
    total: pending.total,
    message: 'Enviando alterações…',
    stepId: 'uploading',
    phase: 'upload',
  });

  const remoteMaps = {
    cadastros: new Map(remoteCad.map((r) => [r.id, remoteToCadastroRecord(r, ownerUid)])),
    sessoes: new Map(remoteSess.map((r) => [r.id, remoteToSessaoRecord(r, ownerUid)])),
    aplicadores: new Map(remoteApp.map((r) => [r.id, remoteToAplicadorRecord(r, ownerUid)])),
  };

  let processed = 0;
  for (const item of pending.items) {
    const local = item.record as SyncRecord;
    if (!isUnsyncedLocalStatus(local.syncStatus)) continue;

    const remote = remoteMaps[item.collection].get(item.id);
    const decision = decideLastWriteWins(local, remote);
    const hasRemote = remoteMaps[item.collection].has(item.id);

    try {
      if (decision.action === 'upload' || (!remote && !local.deleted)) {
        await executePlanItem(
          ownerUid,
          {
            collection: item.collection,
            id: item.id,
            action: 'upload',
            local,
            remote,
            hasRemote,
          },
          uploadFns,
          stats,
          deletionAudits,
        );
      } else if (decision.action === 'download' && remote) {
        await executePlanItem(
          ownerUid,
          {
            collection: item.collection,
            id: item.id,
            action: 'download',
            local,
            remote,
            hasRemote,
          },
          uploadFns,
          stats,
          deletionAudits,
        );
      } else {
        const loginUid = getCachedLoginUid();
        const merged = markRecordSynced({ ...local, ownerUid }, loginUid);
        if (item.collection === 'cadastros') {
          await putCadastroRecord(merged as CadastroRecord);
        } else if (item.collection === 'sessoes') {
          await putSessaoRecord(merged as SessaoRecord);
        } else {
          await putAplicadorRecord(merged as AplicadorRecord);
        }
        stats.ignored += 1;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`${item.collection}/${item.id}: ${msg}`);
    } finally {
      processed += 1;
      progressCb?.({
        processed,
        total: pending.total,
        message: 'Enviando alterações…',
        stepId: 'uploading',
        phase: 'upload',
      });
    }
  }
}

async function persistSyncedLocal<T extends SyncRecord>(
  ownerUid: string,
  local: T,
  collection: CollectionName,
): Promise<void> {
  const synced = markRecordSynced({ ...local, ownerUid }, getCachedLoginUid());
  if (collection === 'cadastros') {
    await putCadastroRecord(synced as CadastroRecord);
  } else if (collection === 'sessoes') {
    await putSessaoRecord(synced as SessaoRecord);
  } else {
    await putAplicadorRecord(synced as AplicadorRecord);
  }
}

async function uploadCadastro(uid: string, local: CadastroRecord, hasRemote: boolean): Promise<void> {
  if (local.deleted) {
    await deleteCadastroFirestore(uid, local.id, buildFirestoreTombstone({ ...local, ownerUid: uid }));
    await persistSyncedLocal(uid, local, 'cadastros');
    return;
  }
  await addCadastroFirestore(uid, stripForFirestore({ ...local, ownerUid: uid }) as CadastroItemPersist);
  await persistSyncedLocal(uid, local, 'cadastros');
}

async function uploadSessao(uid: string, local: SessaoRecord, hasRemote: boolean): Promise<void> {
  const payload = stripForFirestore({ ...local, ownerUid: uid }) as SessaoAplicacaoTaf;
  if (local.deleted) {
    await deleteSessaoFirestore(uid, local.id, buildFirestoreTombstone({ ...local, ownerUid: uid }));
    await persistSyncedLocal(uid, local, 'sessoes');
    return;
  }
  if (hasRemote) {
    await updateSessaoFirestore(uid, payload);
  } else {
    await addSessaoFirestore(uid, payload);
  }
  await persistSyncedLocal(uid, local, 'sessoes');
}

async function uploadAplicador(uid: string, local: AplicadorRecord, hasRemote: boolean): Promise<void> {
  if (local.deleted) {
    await deleteAplicadorFirestore(uid, local.id, buildFirestoreTombstone({ ...local, ownerUid: uid }));
    await persistSyncedLocal(uid, local, 'aplicadores');
    return;
  }
  await addAplicadorFirestore(uid, stripForFirestore({ ...local, ownerUid: uid }) as AplicadorItemPersist);
  await persistSyncedLocal(uid, local, 'aplicadores');
}

async function downloadRecord(
  collection: CollectionName,
  remote: SyncRecord,
  local: SyncRecord | undefined,
  ownerUid: string,
): Promise<void> {
  const merged = markRecordSynced(
    remoteDocToSyncRecord({ ...(local ?? {}), ...remote, ownerUid, id: remote.id }, ownerUid),
    getCachedLoginUid(),
  );
  if (collection === 'cadastros') {
    await putCadastroRecord(merged as CadastroRecord);
  } else if (collection === 'sessoes') {
    await putSessaoRecord(merged as SessaoRecord);
  } else {
    await putAplicadorRecord(merged as AplicadorRecord);
  }
}

type UploadFn = (uid: string, local: SyncRecord, hasRemote: boolean) => Promise<void>;

async function executePlanItem(
  ownerUid: string,
  item: PlannedSyncItem,
  uploadFns: Record<CollectionName, UploadFn>,
  stats: LwwSyncStats,
  deletionAudits: DeletionAuditEntry[],
): Promise<void> {
  const upload = uploadFns[item.collection];

  if (item.action === 'upload' && item.local) {
    await upload(ownerUid, item.local, item.hasRemote);
    stats.uploads += 1;
    if (item.local.deleted) {
      deletionAudits.push(buildDeletionAuditEntry(item.collection, item.local, 'upload', Date.now()));
    }
    return;
  }

  if (item.action === 'download' && item.remote) {
    await downloadRecord(item.collection, item.remote, item.local, ownerUid);
    stats.downloads += 1;
    if (item.remote.deleted) {
      deletionAudits.push(buildDeletionAuditEntry(item.collection, item.remote, 'download', Date.now()));
    }
  }
}

async function ensureNoPendingRemain(ownerUid: string, stats: LwwSyncStats): Promise<void> {
  const remaining = await getPendingSyncItems(ownerUid);
  if (remaining.total > 0) {
    stats.errors.push(`pending_remain:${remaining.total}`);
  }
}

export type SyncPlanSnapshot = {
  downloadItems: PlannedSyncItem[];
  uploadItems: PlannedSyncItem[];
  plannedUploads: number;
  plannedDownloads: number;
  totalIgnored: number;
  localCad: CadastroRecord[];
  localSess: SessaoRecord[];
  localApp: AplicadorRecord[];
  remoteCad: CadastroItemPersist[];
  remoteSess: SessaoAplicacaoTaf[];
  remoteApp: AplicadorItemPersist[];
};

async function buildSyncPlanSnapshot(ownerUid: string): Promise<SyncPlanSnapshot> {
  await migrateDeviceDataOnLogin(ownerUid);

  const [localCad, localSess, localApp, remoteCad, remoteSess, remoteApp] = await Promise.all([
    listCadastrosForSync(ownerUid, true),
    listSessoesForSync(ownerUid, true),
    listAplicadoresForSync(ownerUid, true),
    getAllCadastrosFirestoreLight(ownerUid),
    getAllSessoesFirestoreLight(ownerUid),
    getAllAplicadoresFirestore(ownerUid),
  ]);

  await reconcileIdenticalUnsyncedLocals('cadastros', ownerUid, localCad, remoteCad, remoteToCadastroRecord);
  await reconcileIdenticalUnsyncedLocals('sessoes', ownerUid, localSess, remoteSess, remoteToSessaoRecord);
  await reconcileIdenticalUnsyncedLocals('aplicadores', ownerUid, localApp, remoteApp, remoteToAplicadorRecord);

  const [localCadFresh, localSessFresh, localAppFresh] = await Promise.all([
    listCadastrosForSync(ownerUid, true),
    listSessoesForSync(ownerUid, true),
    listAplicadoresForSync(ownerUid, true),
  ]);

  const cadPlanFresh = buildSyncPlan('cadastros', ownerUid, localCadFresh, remoteCad, remoteToCadastroRecord);
  const sessPlanFresh = buildSyncPlan('sessoes', ownerUid, localSessFresh, remoteSess, remoteToSessaoRecord);
  const appPlanFresh = buildSyncPlan('aplicadores', ownerUid, localAppFresh, remoteApp, remoteToAplicadorRecord);

  const fullPlan = [...cadPlanFresh.plan, ...sessPlanFresh.plan, ...appPlanFresh.plan];
  const downloadItems = fullPlan.filter((p) => p.action === 'download');
  const uploadItems = fullPlan.filter((p) => p.action === 'upload');

  return {
    downloadItems,
    uploadItems,
    plannedUploads: uploadItems.length,
    plannedDownloads: downloadItems.length,
    totalIgnored: cadPlanFresh.ignored + sessPlanFresh.ignored + appPlanFresh.ignored,
    localCad,
    localSess,
    localApp,
    remoteCad,
    remoteSess,
    remoteApp,
  };
}

/** Estima filas de envio (local) e recebimento (nuvem) sem executar sync. */
export async function estimateSyncQueueCounts(
  ownerUid: string,
): Promise<{ pendingUploads: number; pendingDownloads: number }> {
  const [pending, plan] = await Promise.all([
    getPendingSyncItems(ownerUid),
    buildSyncPlanSnapshot(ownerUid),
  ]);
  return {
    pendingUploads: pending.total,
    pendingDownloads: plan.plannedDownloads,
  };
}

async function runPlanPhase(
  ownerUid: string,
  items: PlannedSyncItem[],
  phase: 'download' | 'upload',
  uploadFns: Record<CollectionName, UploadFn>,
  stats: LwwSyncStats,
  deletionAudits: DeletionAuditEntry[],
  progressCb: SyncProgressCallback | undefined,
  plannedUploads: number,
  plannedDownloads: number,
): Promise<void> {
  const total = items.length;
  const stepId: SyncStepId = phase === 'download' ? 'downloading' : 'uploading';
  const message = phase === 'download' ? 'Baixando da nuvem…' : 'Enviando alterações…';

  if (total === 0) {
    progressCb?.({
      processed: 1,
      total: 1,
      message: phase === 'download' ? 'Nada para baixar da nuvem' : 'Nada para enviar',
      stepId,
      pendingUploads: plannedUploads,
      pendingDownloads: plannedDownloads,
      phase,
    });
    return;
  }

  let processed = 0;
  for (const item of items) {
    progressCb?.({
      processed,
      total,
      message,
      stepId,
      pendingUploads: plannedUploads,
      pendingDownloads: plannedDownloads,
      phase,
    });

    try {
      await executePlanItem(ownerUid, item, uploadFns, stats, deletionAudits);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`${item.collection}/${item.id}: ${msg}`);
      const failedRecord = item.local?.deleted ? item.local : item.remote?.deleted ? item.remote : null;
      if (failedRecord?.deleted) {
        deletionAudits.push(
          buildDeletionAuditEntry(
            item.collection,
            failedRecord,
            phase,
            Date.now(),
            true,
          ),
        );
      }
    } finally {
      processed += 1;
      progressCb?.({
        processed,
        total,
        message:
          phase === 'download' && processed === total ? 'Atualizando banco local…' : message,
        stepId: phase === 'download' && processed === total ? 'updating_local' : stepId,
        pendingUploads: plannedUploads,
        pendingDownloads: plannedDownloads,
        phase,
      });
    }
  }
}

export async function executeLastWriteWinsSync(
  ownerUid: string,
  options?: {
    backupId?: number | null;
    clockDrift?: ClockDriftResult;
    userEmail?: string | null;
    onProgress?: SyncProgressCallback;
  },
): Promise<{
  success: boolean;
  stats: LwwSyncStats;
  audit: SyncAuditEntry;
  alreadyUpToDate: boolean;
  plannedUploads: number;
  plannedDownloads: number;
}> {
  const startedAt = Date.now();
  const stats: LwwSyncStats = { uploads: 0, downloads: 0, ignored: 0, errors: [] };
  const deletionAudits: DeletionAuditEntry[] = [];
  const deviceId = await getDeviceId();
  const progressCb = options?.onProgress;

  progressCb?.({
    processed: 0,
    total: 0,
    message: 'Preparando dados locais',
    stepId: 'comparing',
    phase: 'compare',
  });

  progressCb?.({
    processed: 0,
    total: 0,
    message: 'Comparando registros',
    stepId: 'comparing',
    phase: 'compare',
  });

  const plan = await buildSyncPlanSnapshot(ownerUid);
  const {
    downloadItems,
    uploadItems,
    plannedUploads,
    plannedDownloads,
    totalIgnored,
    localCad,
    localSess,
    localApp,
    remoteCad,
    remoteSess,
    remoteApp,
  } = plan;
  const workTotal = plannedUploads + plannedDownloads;

  progressCb?.({
    processed: 0,
    total: workTotal || 1,
    message: 'Comparando registros',
    stepId: 'comparing',
    pendingUploads: plannedUploads,
    pendingDownloads: plannedDownloads,
    phase: 'compare',
  });

  const uploadFns: Record<CollectionName, UploadFn> = {
    cadastros: uploadCadastro as UploadFn,
    sessoes: uploadSessao as UploadFn,
    aplicadores: uploadAplicador as UploadFn,
  };

  if (workTotal === 0) {
    stats.ignored = totalIgnored;
    await runPlanPhase(
      ownerUid,
      downloadItems,
      'download',
      uploadFns,
      stats,
      deletionAudits,
      progressCb,
      plannedUploads,
      plannedDownloads,
    );
    await flushRemainingPendingRecords(
      ownerUid,
      remoteCad,
      remoteSess,
      remoteApp,
      uploadFns,
      stats,
      deletionAudits,
      progressCb,
    );
    const emailErrors = await pushPendingAuthorizedEmails(ownerUid);
    stats.errors.push(...emailErrors);
    await syncQueue.clearDone(ownerUid);

    await ensureNoPendingRemain(ownerUid, stats);

    const finishedAt = Date.now();
    const activeRemote = (rows: Array<{ deleted?: boolean }>) => rows.filter((r) => r.deleted !== true).length;
    const collectionCounts = {
      cadastros: { local: localCad.filter((r) => !r.deleted).length, remote: activeRemote(remoteCad) },
      sessoes: { local: localSess.filter((r) => !r.deleted).length, remote: activeRemote(remoteSess) },
      aplicadores: { local: localApp.filter((r) => !r.deleted).length, remote: activeRemote(remoteApp) },
    };

    const audit = await appendSyncAudit({
      ownerUid,
      userId: getCachedLoginUid(),
      userEmail: options?.userEmail ?? null,
      deviceId,
      appVersion: APP_VERSION,
      startedAt,
      finishedAt,
      uploads: stats.uploads,
      downloads: stats.downloads,
      ignored: stats.ignored,
      errors: stats.errors,
      errorMessage: stats.errors[0] ?? null,
      localTimeMs: options?.clockDrift?.localTimeMs,
      serverTimeMs: options?.clockDrift?.serverTimeMs ?? null,
      clockDriftMs: options?.clockDrift?.driftMs,
      clockDriftWarning: options?.clockDrift?.warning,
      backupId: options?.backupId ?? null,
      collectionCounts,
      failures: stats.errors.length,
      deletions: deletionAudits,
    });

    return {
      success: stats.errors.length === 0,
      stats,
      audit,
      alreadyUpToDate:
        stats.errors.length === 0 &&
        stats.uploads === 0 &&
        stats.downloads === 0 &&
        totalIgnored > 0,
      plannedUploads: 0,
      plannedDownloads: 0,
    };
  }

  await runPlanPhase(
    ownerUid,
    downloadItems,
    'download',
    uploadFns,
    stats,
    deletionAudits,
    progressCb,
    plannedUploads,
    plannedDownloads,
  );
  await runPlanPhase(
    ownerUid,
    uploadItems,
    'upload',
    uploadFns,
    stats,
    deletionAudits,
    progressCb,
    plannedUploads,
    plannedDownloads,
  );

  stats.ignored = totalIgnored;

  progressCb?.({
    processed: workTotal,
    total: workTotal,
    message: 'Finalizando',
    stepId: 'finalizing',
    pendingUploads: plannedUploads,
    pendingDownloads: plannedDownloads,
    phase: 'finalize',
  });

  const emailErrors = await pushPendingAuthorizedEmails(ownerUid);
  stats.errors.push(...emailErrors);

  await syncQueue.clearDone(ownerUid);

  await flushRemainingPendingRecords(
    ownerUid,
    remoteCad,
    remoteSess,
    remoteApp,
    uploadFns,
    stats,
    deletionAudits,
    progressCb,
  );

  if (stats.errors.length === 0) {
    await runDeletionGarbageCollection(ownerUid);
  }

  await ensureNoPendingRemain(ownerUid, stats);

  const finishedAt = Date.now();
  const activeRemote = (rows: Array<{ deleted?: boolean }>) => rows.filter((r) => r.deleted !== true).length;
  const collectionCounts = {
    cadastros: { local: localCad.filter((r) => !r.deleted).length, remote: activeRemote(remoteCad) },
    sessoes: { local: localSess.filter((r) => !r.deleted).length, remote: activeRemote(remoteSess) },
    aplicadores: { local: localApp.filter((r) => !r.deleted).length, remote: activeRemote(remoteApp) },
  };

  const audit = await appendSyncAudit({
    ownerUid,
    userId: getCachedLoginUid(),
    userEmail: options?.userEmail ?? null,
    deviceId,
    appVersion: APP_VERSION,
    startedAt,
    finishedAt,
    uploads: stats.uploads,
    downloads: stats.downloads,
    ignored: stats.ignored,
    errors: stats.errors,
    errorMessage: stats.errors[0] ?? null,
    localTimeMs: options?.clockDrift?.localTimeMs,
    serverTimeMs: options?.clockDrift?.serverTimeMs ?? null,
    clockDriftMs: options?.clockDrift?.driftMs,
    clockDriftWarning: options?.clockDrift?.warning,
    backupId: options?.backupId ?? null,
    collectionCounts,
    failures: stats.errors.length,
    deletions: deletionAudits,
  });

  return {
    success: stats.errors.length === 0,
    stats,
    audit,
    alreadyUpToDate: false,
    plannedUploads,
    plannedDownloads,
  };
}

// Re-export for tests that may import countIds pattern
export { countIds };
