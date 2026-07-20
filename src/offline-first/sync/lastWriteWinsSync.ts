import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import {
  addCadastroFirestore,
  deleteCadastroFirestore,
} from './firebase/FirebaseGateway';
import {
  addAplicadorFirestore,
  deleteAplicadorFirestore,
} from './firebase/FirebaseGateway';
import {
  addSessaoFirestore,
  updateSessaoFirestore,
  deleteSessaoFirestore,
} from './firebase/FirebaseGateway';
import {
  addPreCadastroFirestore,
  deletePreCadastroFirestore,
} from './firebase/FirebaseGateway';
import { mergeCadastroRubricas } from '../../utils/cadastroLight';
import { getCadastroRubricasFirestore } from '../../services/firebase/cadastroRubricasFirestore';
import { getSessaoRubricasFirestore } from '../../services/firebase/sessaoRubricasFirestore';
import { normalizeSessaoShape, type SessaoResultadoRubrica } from '../../utils/sessaoLight';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import {
  isAuthorizedMemberSession,
  isMemberAplicadorSenhaChange,
  mergeAplicadorAfterRemoteDownload,
  toAplicadorFirestorePayload,
} from '../../utils/aplicadorSyncPolicy';
import { getDeviceId } from '../deviceId';
import type {
  AplicadorRecord,
  CadastroRecord,
  CollectionName,
  PreCadastroRecord,
  SessaoRecord,
} from '../types';
import {
  listAplicadoresForSync,
  listCadastrosForSync,
  listSessoesForSync,
  getAplicadorRaw,
  getCadastroRaw,
  getSessaoRaw,
  putAplicadorRecord,
  putCadastroRecord,
  putSessaoRecord,
} from '../db/localDb';
import {
  putPreCadastroRecord,
} from '../db/preCadastroLocalDb';
import { listPreCadastros } from '../db/preCadastroLocalDb';
import { isCloudSyncCollection } from './preCadastroLocalOnly';
import { decideLastWriteWins, type LwwAction, type SyncRecord } from './lastWriteWins';
import { markRecordSynced, readUpdatedAt } from './recordMeta';
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
  type TombstonePayload,
} from './tombstone';
import {
  buildDeletionAuditEntry,
  runDeletionGarbageCollection,
} from './deletionGarbageCollection';
import type { SyncStepId } from './syncSteps';
import { getPendingSyncItems } from './pendingSyncItems';
import { buildDownloadBreakdown, type SyncQueueBreakdown } from './syncQueueBreakdown';
import {
  buildDownloadRubricCaches,
  type DownloadRubricCaches,
} from './downloadRubricCache';
import {
  fetchRemoteCollectionsSnapshot,
  invalidateRemoteSnapshotCache,
} from './remoteSnapshotCache';
import { forceNextFullRemoteFetch } from './syncWatermark';
import {
  countBusinessContentDrift,
  resolveContentDriftAction,
  syncBusinessContentEqual,
} from './syncBusinessContent';
import {
  formatPlaintextAuditSummary,
  listLwwPlaintextForceUploadIds,
  reencryptDirectPlaintextTables,
} from '../../services/supabase/e2ePlaintextAudit';
import { getActiveTeamKey } from '../../services/supabase/e2eCrypto';
import { alignRedundantDownloads } from './redundantDownloadGuard';
import { syncLogger } from './SyncLogger';

const DOWNLOAD_CONCURRENCY = 8;

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

/** Sanitização única de payload ativo para a nuvem — usada pelo LWW e pela SyncQueue. */
export function stripForCloud<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  // Mantém syncVersion/version/updatedAt no JSON da nuvem — sem isso o LWW
  // interpreta remoto=1 e local=N e reenvia o banco inteiro a cada sync.
  for (const key of [
    'ownerUid',
    'syncStatus',
    'lastSync',
    'updatedBy',
    'deviceId',
    'userId',
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

/** @deprecated alias — mesmo comportamento de stripForCloud */
function stripForFirestore<T extends Record<string, unknown>>(row: T): T {
  return stripForCloud(row);
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

function remoteToPreCadastroRecord(remote: PreCadastroRecord, ownerUid: string): PreCadastroRecord {
  return remoteDocToSyncRecord<PreCadastroRecord>(remote as Record<string, unknown> & { id: string }, ownerUid);
}

/** Converte tombstone remoto em SyncRecord deleted=true para o LWW. */
export function tombstonePayloadToSyncRecord(
  tombstone: TombstonePayload,
  ownerUid: string,
): SyncRecord {
  return remoteDocToSyncRecord(
    {
      id: tombstone.id,
      updatedAt: tombstone.updatedAt,
      deleted: true,
      deletedAt: tombstone.deletedAt ?? tombstone.updatedAt,
      deletedBy: tombstone.deletedBy,
      syncVersion: tombstone.syncVersion,
      version: tombstone.syncVersion,
      updatedBy: tombstone.updatedBy,
      deviceId: tombstone.deviceId ?? 'remote',
    },
    ownerUid,
  );
}

/**
 * Preenche o mapa remoto: ativos + tombstones.
 * Tombstone mais recente (ou empate de exclusão) prevalece sobre ativo obsoleto —
 * evita histórico fantasma quando o delta incremental ainda carrega ativo antigo.
 */
export function mergeRemoteMapWithTombstones(
  remoteMap: Map<string, SyncRecord>,
  tombstones: TombstonePayload[] | undefined,
  ownerUid: string,
): Map<string, SyncRecord> {
  if (!tombstones?.length) return remoteMap;
  for (const tombstone of tombstones) {
    const tombRec = tombstonePayloadToSyncRecord(tombstone, ownerUid);
    const existing = remoteMap.get(tombstone.id);
    if (!existing) {
      remoteMap.set(tombstone.id, tombRec);
      continue;
    }
    const decision = decideLastWriteWins(existing, tombRec);
    if (decision.action === 'download') {
      remoteMap.set(tombstone.id, tombRec);
      continue;
    }
    // Empate temporal com exclusão remota: nuvem manda.
    if (
      existing.deleted !== true &&
      tombRec.deleted === true &&
      readUpdatedAt(tombRec) >= readUpdatedAt(existing)
    ) {
      remoteMap.set(tombstone.id, tombRec);
    }
  }
  return remoteMap;
}

function buildRemoteMapForLww<TRemote extends { id: string }>(
  ownerUid: string,
  remoteRows: TRemote[],
  toRecord: (remote: TRemote, ownerUid: string) => SyncRecord,
  tombstones?: TombstonePayload[],
): Map<string, SyncRecord> {
  const remoteMap = new Map(remoteRows.map((r) => [r.id, toRecord(r, ownerUid)]));
  return mergeRemoteMapWithTombstones(remoteMap, tombstones, ownerUid);
}

function applySessaoRubricasFromRemote(
  sessao: SessaoAplicacaoTaf,
  rubDoc: { resultados: SessaoResultadoRubrica[] },
): SessaoAplicacaoTaf {
  const byKey = new Map(
    rubDoc.resultados.map((r) => [`${r.nip}:${r.prova}`, r.rubricaCandidatoSvg] as const),
  );
  const normalized = normalizeSessaoShape(sessao);
  return {
    ...normalized,
    resultados: normalized.resultados.map((r) => {
      const prova = r.prova ?? normalized.tipoProva;
      const svg = byKey.get(`${r.nip}:${prova}`);
      return svg ? { ...r, rubricaCandidatoSvg: svg } : r;
    }),
  };
}

function countIds(local: SyncRecord[], remote: { id: string }[]): number {
  const ids = new Set([...local.map((r) => r.id), ...remote.map((r) => r.id)]);
  return ids.size;
}

/** Detecta divergência de presença (ativo × excluído) que o LWW possa não enfileirar. */
function countActivePresenceDrift(
  localRows: SyncRecord[],
  remoteRows: Array<{ id: string }>,
  toRecord: (remote: { id: string }, ownerUid: string) => SyncRecord,
  ownerUid: string,
): { extraDownloads: number; extraUploads: number } {
  let extraDownloads = 0;
  let extraUploads = 0;
  const allIds = new Set([...localRows.map((r) => r.id), ...remoteRows.map((r) => r.id)]);

  for (const id of allIds) {
    const local = localRows.find((r) => r.id === id);
    const remoteRaw = remoteRows.find((r) => r.id === id);
    const remote = remoteRaw ? toRecord(remoteRaw, ownerUid) : undefined;
    const localActive = local != null && local.deleted !== true;
    const remoteActive = remote != null && remote.deleted !== true;
    if (localActive === remoteActive) continue;
    if (remoteActive && !localActive) extraDownloads += 1;
    // Ausência na nuvem: espelho autoritativo baixa/prune — não conta como upload.
    if (localActive && !remoteActive) extraDownloads += 1;
  }

  return { extraDownloads, extraUploads };
}

function buildSyncPlan<TLocal extends SyncRecord, TRemote extends { id: string }>(
  collection: CollectionName,
  ownerUid: string,
  localRows: TLocal[],
  remoteRows: TRemote[],
  toRecord: (remote: TRemote, ownerUid: string) => SyncRecord,
  forceUploadIds?: Set<string>,
  remoteTombstones?: TombstonePayload[],
  fetchMode: 'full' | 'incremental' = 'full',
): { plan: PlannedSyncItem[]; ignored: number; syncedMissingOnCloud: number } {
  const localMap = new Map(localRows.map((r) => [r.id, r]));
  const remoteMap = buildRemoteMapForLww(ownerUid, remoteRows, toRecord, remoteTombstones);
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const plan: PlannedSyncItem[] = [];
  let ignored = 0;
  let syncedMissingOnCloud = 0;

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    const hasRemote = remoteMap.has(id);
    const decision = decideLastWriteWins(local, remote);

    // Id só no local (já synced):
    // - full fetch (nuvem autoritativa): remover local — ausência na nuvem = verdade.
    // - incremental: não apagar (snapshot parcial); marca para full fetch depois.
    if (
      decision.action === 'upload' &&
      decision.reason === 'somente_local' &&
      local &&
      !isUnsyncedLocalStatus(local.syncStatus) &&
      !forceUploadIds?.has(id)
    ) {
      if (fetchMode === 'full') {
        const pruneAt = Math.max(readUpdatedAt(local) + 1, Date.now());
        plan.push({
          collection,
          id,
          action: 'download',
          local,
          remote: {
            ...local,
            deleted: true,
            updatedAt: pruneAt,
            syncStatus: 'synced',
            syntheticCloudAbsence: true,
          } as SyncRecord,
          hasRemote: false,
        });
        continue;
      }
      syncedMissingOnCloud += 1;
      ignored += 1;
      continue;
    }

    if (decision.action === 'skip') {
      if (forceUploadIds?.has(id) && local) {
        plan.push({
          collection,
          id,
          action: 'upload',
          // Bump updatedAt para gravar ciphertext e refletir na coluna updated_at
          local: { ...local, updatedAt: Date.now() },
          remote,
          hasRemote: hasRemote,
        });
        continue;
      }
      if (
        local &&
        remote &&
        !syncBusinessContentEqual(collection, local, remote)
      ) {
        plan.push({
          collection,
          id,
          action: resolveContentDriftAction(local, remote),
          local,
          remote,
          hasRemote,
        });
        continue;
      }
      ignored += 1;
      continue;
    }

    // Já existe na nuvem com o mesmo conteúdo de negócio → não reenviar
    // (evita tempestade de ~1200 uploads por syncVersion/updatedAt fantasma).
    if (
      decision.action === 'upload' &&
      local &&
      remote &&
      syncBusinessContentEqual(collection, local, remote) &&
      !forceUploadIds?.has(id)
    ) {
      ignored += 1;
      continue;
    }

    // Local já marcado synced e não é mais novo que o remoto → não reenviar.
    if (
      decision.action === 'upload' &&
      local &&
      remote &&
      !isUnsyncedLocalStatus(local.syncStatus) &&
      readUpdatedAt(local) <= readUpdatedAt(remote) &&
      !forceUploadIds?.has(id)
    ) {
      ignored += 1;
      continue;
    }

    plan.push({
      collection,
      id,
      action: decision.action,
      local:
        forceUploadIds?.has(id) && local && decision.action === 'upload'
          ? { ...local, updatedAt: Date.now() }
          : local,
      remote,
      hasRemote,
    });
  }

  return { plan, ignored, syncedMissingOnCloud };
}

/** Alinha syncStatus local quando LWW ignora registro já idêntico ao remoto. */
async function reconcileIdenticalUnsyncedLocals<TLocal extends SyncRecord, TRemote extends { id: string }>(
  collection: CollectionName,
  ownerUid: string,
  localRows: TLocal[],
  remoteRows: TRemote[],
  toRecord: (remote: TRemote, ownerUid: string) => SyncRecord,
  remoteTombstones?: TombstonePayload[],
): Promise<number> {
  if (!isCloudSyncCollection(collection)) return 0;
  const remoteMap = buildRemoteMapForLww(ownerUid, remoteRows, toRecord, remoteTombstones);
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
  remotePre: PreCadastroRecord[],
  uploadFns: Record<CollectionName, UploadFn>,
  stats: LwwSyncStats,
  deletionAudits: DeletionAuditEntry[],
  progressCb?: SyncProgressCallback,
  remoteCadTombstones: TombstonePayload[] = [],
  remoteSessTombstones: TombstonePayload[] = [],
  remoteAppTombstones: TombstonePayload[] = [],
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
    cadastros: buildRemoteMapForLww(ownerUid, remoteCad, remoteToCadastroRecord, remoteCadTombstones),
    sessoes: buildRemoteMapForLww(ownerUid, remoteSess, remoteToSessaoRecord, remoteSessTombstones),
    aplicadores: buildRemoteMapForLww(ownerUid, remoteApp, remoteToAplicadorRecord, remoteAppTombstones),
    pre_cadastros: buildRemoteMapForLww(ownerUid, remotePre, remoteToPreCadastroRecord),
  };

  let processed = 0;
  for (const item of pending.items) {
    if (!isCloudSyncCollection(item.collection)) continue;
    const local = item.record as SyncRecord;
    if (!isUnsyncedLocalStatus(local.syncStatus)) continue;

    if (isAuthorizedMemberSession() && item.collection === 'aplicadores') {
      const remote = remoteMaps.aplicadores.get(item.id);
      const decision = remote ? decideLastWriteWins(local, remote) : null;
      const membroTrocaSenha =
        !!remote &&
        decision?.action === 'upload' &&
        isMemberAplicadorSenhaChange(local as AplicadorRecord, remote as AplicadorRecord);
      try {
        if (remote && membroTrocaSenha) {
          await executePlanItem(
            ownerUid,
            {
              collection: 'aplicadores',
              id: item.id,
              action: 'upload',
              local,
              remote,
              hasRemote: true,
            },
            uploadFns,
            stats,
            deletionAudits,
          );
        } else if (remote) {
          await executePlanItem(
            ownerUid,
            {
              collection: 'aplicadores',
              id: item.id,
              action: 'download',
              local,
              remote,
              hasRemote: true,
            },
            uploadFns,
            stats,
            deletionAudits,
          );
        } else {
          const loginUid = getCachedLoginUid();
          const merged = markRecordSynced({ ...local, ownerUid }, loginUid);
          await putAplicadorRecord(merged as AplicadorRecord);
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
      continue;
    }

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
  // Safe Sync Commit (7.3): só marca synced se a versão local ainda for a enviada.
  const { isQueuePayloadStillCurrent } = await import('./queueSyncGuard');
  const coll =
    collection === 'cadastros' || collection === 'sessoes' || collection === 'aplicadores'
      ? collection
      : null;
  if (coll) {
    const still = await isQueuePayloadStillCurrent(coll, local.id, local);
    if (!still) return;
  }
  const synced = markRecordSynced({ ...local, ownerUid }, getCachedLoginUid());
  if (collection === 'cadastros') {
    await putCadastroRecord(synced as CadastroRecord);
  } else if (collection === 'sessoes') {
    await putSessaoRecord(synced as SessaoRecord);
  } else if (collection === 'aplicadores') {
    await putAplicadorRecord(synced as AplicadorRecord);
  }
  // Limpa fila órfã do documento após sync bem-sucedido.
  if (coll) {
    await syncQueue.clearPendingForDocument(ownerUid, coll, local.id);
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
  await addAplicadorFirestore(
    uid,
    toAplicadorFirestorePayload(stripForFirestore({ ...local, ownerUid: uid }) as AplicadorItemPersist),
  );
  await persistSyncedLocal(uid, local, 'aplicadores');
}

async function uploadPreCadastro(uid: string, local: PreCadastroRecord, hasRemote: boolean): Promise<void> {
  if (local.deleted) {
    await deletePreCadastroFirestore(uid, local.id, buildFirestoreTombstone({ ...local, ownerUid: uid }));
    await persistSyncedLocal(uid, local, 'pre_cadastros');
    return;
  }
  await addPreCadastroFirestore(uid, { ...local, ownerUid: uid });
  await persistSyncedLocal(uid, local, 'pre_cadastros');
}

async function downloadRecord(
  collection: CollectionName,
  remote: SyncRecord,
  ownerUid: string,
  rubricCaches?: DownloadRubricCaches,
): Promise<void> {
  // 7.3: relê Dexie fresh e re-decide LWW — download antigo não sobrescreve edição local.
  const localFresh =
    collection === 'cadastros'
      ? await getCadastroRaw(remote.id)
      : collection === 'sessoes'
        ? await getSessaoRaw(remote.id)
        : collection === 'aplicadores'
          ? await getAplicadorRaw(remote.id)
          : null;
  if (localFresh) {
    const decision = decideLastWriteWins(localFresh as SyncRecord, remote);
    if (decision.action !== 'download') {
      return;
    }
  }

  // Exclusão remota de sessão: limpa cadastro só para tombstone real (não ausência sintética).
  if (
    collection === 'sessoes' &&
    remote.deleted === true &&
    localFresh &&
    (localFresh as SessaoRecord).deleted !== true &&
    (remote as SyncRecord & { syntheticCloudAbsence?: boolean }).syntheticCloudAbsence !== true
  ) {
    try {
      const { clearCadastrosForSessaoHistorico } = await import(
        '../../services/deleteSessaoHistorico'
      );
      await clearCadastrosForSessaoHistorico(localFresh as SessaoRecord, ownerUid);
    } catch (error) {
      console.warn('[sync] limpeza de cadastro após tombstone de sessão falhou:', error);
    }
  }

  let payload: SyncRecord = remote;
  if (collection === 'cadastros' && remote.deleted !== true) {
    // Com cache pré-carregado: ausência = sem rubrica (NÃO refetch da tabela inteira).
    const rubricas = rubricCaches
      ? (rubricCaches.cadastros.get(remote.id) ?? null)
      : await getCadastroRubricasFirestore(ownerUid, remote.id);
    if (rubricas) {
      payload = mergeCadastroRubricas(payload as CadastroRecord, rubricas) as SyncRecord;
    }
  } else if (collection === 'sessoes' && remote.deleted !== true) {
    const rubDoc = rubricCaches
      ? (rubricCaches.sessoes.get(remote.id) ?? null)
      : await getSessaoRubricasFirestore(ownerUid, remote.id);
    if (rubDoc) {
      payload = applySessaoRubricasFromRemote(payload as SessaoRecord, rubDoc) as SyncRecord;
    }
  } else if (collection === 'aplicadores' && remote.deleted !== true) {
    const existing = await getAplicadorRaw(remote.id);
    const business = mergeAplicadorAfterRemoteDownload(
      payload as AplicadorItemPersist,
      existing,
      isAuthorizedMemberSession(),
    );
    payload = { ...payload, ...business } as SyncRecord;
  }

  const merged = markRecordSynced(
    remoteDocToSyncRecord({ ...payload, ownerUid, id: remote.id }, ownerUid),
    getCachedLoginUid(),
  );
  if (collection === 'cadastros') {
    await putCadastroRecord(merged as CadastroRecord);
    await syncQueue.clearPendingForDocument(ownerUid, 'cadastros', remote.id);
  } else if (collection === 'sessoes') {
    await putSessaoRecord(merged as SessaoRecord);
    await syncQueue.clearPendingForDocument(ownerUid, 'sessoes', remote.id);
  } else {
    await putAplicadorRecord(merged as AplicadorRecord);
    await syncQueue.clearPendingForDocument(ownerUid, 'aplicadores', remote.id);
  }
}

type UploadFn = (uid: string, local: SyncRecord, hasRemote: boolean) => Promise<void>;

async function executePlanItem(
  ownerUid: string,
  item: PlannedSyncItem,
  uploadFns: Record<CollectionName, UploadFn>,
  stats: LwwSyncStats,
  deletionAudits: DeletionAuditEntry[],
  rubricCaches?: DownloadRubricCaches,
): Promise<void> {
  if (!isCloudSyncCollection(item.collection)) {
    stats.ignored += 1;
    return;
  }
  const upload = uploadFns[item.collection];

  if (item.action === 'upload' && item.local) {
    if (
      isAuthorizedMemberSession() &&
      item.collection === 'aplicadores' &&
      !isMemberAplicadorSenhaChange(
        item.local as AplicadorRecord,
        item.remote as AplicadorRecord | undefined,
      )
    ) {
      stats.ignored += 1;
      return;
    }
    await upload(ownerUid, item.local, item.hasRemote);
    stats.uploads += 1;
    if (item.local.deleted) {
      deletionAudits.push(buildDeletionAuditEntry(item.collection, item.local, 'upload', Date.now()));
    }
    return;
  }

  if (item.action === 'download' && item.remote) {
    await downloadRecord(item.collection, item.remote, ownerUid, rubricCaches);
    stats.downloads += 1;
    if (item.remote.deleted) {
      deletionAudits.push(buildDeletionAuditEntry(item.collection, item.remote, 'download', Date.now()));
    }
  }
}

async function ensureNoPendingRemain(ownerUid: string, stats: LwwSyncStats): Promise<void> {
  const remaining = await getPendingSyncItems(ownerUid);
  // E-mails autorizados têm fila própria; não falham o LWW (evita retry em loop).
  const nonEmail = remaining.total - (remaining.authorizedEmails ?? 0);
  if (nonEmail > 0) {
    stats.errors.push(`pending_remain:${nonEmail}`);
  }
}

/** Reprotege tabelas owner_docs fora do plano LWW (rubricas, senhas, pré-cadastros). */
async function protectDirectPlaintextCloudDocs(
  ownerUid: string,
  stats: LwwSyncStats,
  progressCb?: SyncProgressCallback,
): Promise<void> {
  if (!getActiveTeamKey()) return;
  try {
    progressCb?.({
      processed: 0,
      total: 1,
      message: 'Protegendo registros antigos na nuvem…',
      stepId: 'finalizing',
      phase: 'finalize',
    });
    const summary = await reencryptDirectPlaintextTables(ownerUid, (message, processed, total) => {
      progressCb?.({
        processed,
        total: Math.max(total, 1),
        message,
        stepId: 'finalizing',
        phase: 'finalize',
      });
    });
    await syncLogger.info('e2e', `Reproteção direta: ${formatPlaintextAuditSummary(summary)}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    stats.errors.push(`e2e_plaintext_reencrypt:${detail}`);
    await syncLogger.warn('e2e', `Falha ao reproteger docs plaintext: ${detail}`);
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
  localPre: PreCadastroRecord[];
  remoteCad: CadastroItemPersist[];
  remoteSess: SessaoAplicacaoTaf[];
  remoteApp: AplicadorItemPersist[];
  remotePre: PreCadastroRecord[];
  remoteCadTombstones: TombstonePayload[];
  remoteSessTombstones: TombstonePayload[];
  remoteAppTombstones: TombstonePayload[];
};

async function buildSyncPlanSnapshot(ownerUid: string, forceRemote = false): Promise<SyncPlanSnapshot> {
  const [localCad, localSess, localApp] = await Promise.all([
    listCadastrosForSync(ownerUid, true),
    listSessoesForSync(ownerUid, true),
    listAplicadoresForSync(ownerUid, true),
  ]);

  let remoteSnapshot = await fetchRemoteCollectionsSnapshot(ownerUid, forceRemote);
  let {
    remoteCad,
    remoteSess,
    remoteApp,
    remoteCadTombstones = [],
    remoteSessTombstones = [],
    remoteAppTombstones = [],
  } = remoteSnapshot;
  const remotePre: PreCadastroRecord[] = [];

  // Etapa 2: em toda sync com chave E2E ativa, forçar reenvio dos docs ainda
  // em texto plano (cadastros/sessões/aplicadores) — não só no full fetch.
  const plainIds = await listLwwPlaintextForceUploadIds(ownerUid);
  const plainCadIds = plainIds.cadastros;
  const plainSessIds = plainIds.sessoes;
  const plainAppIds = plainIds.aplicadores;
  const plainTotal = plainCadIds.size + plainSessIds.size + plainAppIds.size;
  if (plainTotal > 0) {
    await syncLogger.info(
      'e2e',
      `Reproteção LWW: ${plainTotal} doc(s) em texto plano (cad:${plainCadIds.size} sess:${plainSessIds.size} app:${plainAppIds.size})`,
    );
  }

  const runReconcileAndPlan = async (fetchMode: 'full' | 'incremental') => {
    await reconcileIdenticalUnsyncedLocals(
      'cadastros',
      ownerUid,
      localCad,
      remoteCad,
      remoteToCadastroRecord,
      remoteCadTombstones,
    );
    await reconcileIdenticalUnsyncedLocals(
      'sessoes',
      ownerUid,
      localSess,
      remoteSess,
      remoteToSessaoRecord,
      remoteSessTombstones,
    );
    await reconcileIdenticalUnsyncedLocals(
      'aplicadores',
      ownerUid,
      localApp,
      remoteApp,
      remoteToAplicadorRecord,
      remoteAppTombstones,
    );

    const [localCadFresh, localSessFresh, localAppFresh] = await Promise.all([
      listCadastrosForSync(ownerUid, true),
      listSessoesForSync(ownerUid, true),
      listAplicadoresForSync(ownerUid, true),
    ]);

    const cadPlanFresh = buildSyncPlan(
      'cadastros',
      ownerUid,
      localCadFresh,
      remoteCad,
      remoteToCadastroRecord,
      plainCadIds,
      remoteCadTombstones,
      fetchMode,
    );
    const sessPlanFresh = buildSyncPlan(
      'sessoes',
      ownerUid,
      localSessFresh,
      remoteSess,
      remoteToSessaoRecord,
      plainSessIds,
      remoteSessTombstones,
      fetchMode,
    );
    const appPlanFresh = buildSyncPlan(
      'aplicadores',
      ownerUid,
      localAppFresh,
      remoteApp,
      remoteToAplicadorRecord,
      plainAppIds,
      remoteAppTombstones,
      fetchMode,
    );

    return { cadPlanFresh, sessPlanFresh, appPlanFresh, localCadFresh, localSessFresh, localAppFresh };
  };

  let planned = await runReconcileAndPlan(remoteSnapshot.fetchMode);

  // Incremental viu ids sincronizados ausentes na nuvem → full fetch imediato (nuvem = SoT).
  const missingHint =
    planned.cadPlanFresh.syncedMissingOnCloud +
    planned.sessPlanFresh.syncedMissingOnCloud +
    planned.appPlanFresh.syncedMissingOnCloud;
  if (remoteSnapshot.fetchMode === 'incremental' && missingHint > 0) {
    await syncLogger.info(
      'sync-lww',
      `Full fetch: ${missingHint} registro(s) sincronizado(s) ausente(s) no snapshot incremental`,
    );
    await forceNextFullRemoteFetch(ownerUid);
    invalidateRemoteSnapshotCache();
    remoteSnapshot = await fetchRemoteCollectionsSnapshot(ownerUid, true);
    ({
      remoteCad,
      remoteSess,
      remoteApp,
      remoteCadTombstones = [],
      remoteSessTombstones = [],
      remoteAppTombstones = [],
    } = remoteSnapshot);
    planned = await runReconcileAndPlan(remoteSnapshot.fetchMode);
  }

  const { cadPlanFresh, sessPlanFresh, appPlanFresh, localCadFresh, localSessFresh, localAppFresh } =
    planned;

  const fullPlan = [...cadPlanFresh.plan, ...sessPlanFresh.plan, ...appPlanFresh.plan];
  const plannedDownloadItems = fullPlan.filter((p) => p.action === 'download');
  // Downloads redundantes (conteúdo idêntico ao local, só metadados de sync
  // divergentes — ex.: reupload de re-criptografia) viram alinhamento local.
  const { remaining: downloadItems, aligned: alignedDownloads } = await alignRedundantDownloads(
    ownerUid,
    plannedDownloadItems,
  );
  const uploadItems = fullPlan
    .filter((p) => p.action === 'upload')
    .filter(
      (p) =>
        !(
          isAuthorizedMemberSession() &&
          p.collection === 'aplicadores' &&
          !isMemberAplicadorSenhaChange(
            p.local as AplicadorRecord | undefined,
            p.remote as AplicadorRecord | undefined,
          )
        ),
    );

  const localPre = await listPreCadastros(ownerUid);

  return {
    downloadItems,
    uploadItems,
    plannedUploads: uploadItems.length,
    plannedDownloads: downloadItems.length,
    totalIgnored: cadPlanFresh.ignored + sessPlanFresh.ignored + appPlanFresh.ignored + alignedDownloads,
    localCad: localCadFresh,
    localSess: localSessFresh,
    localApp: localAppFresh,
    localPre,
    remoteCad,
    remoteSess,
    remoteApp,
    remotePre,
    remoteCadTombstones,
    remoteSessTombstones,
    remoteAppTombstones,
  };
}

/** Estima filas de envio (local) e recebimento (nuvem) comparando IndexedDB × Firebase. */
export async function estimateSyncQueueCounts(
  ownerUid: string,
  forceRemote = false,
): Promise<{
  pendingUploads: number;
  pendingDownloads: number;
  downloadBreakdown: SyncQueueBreakdown;
}> {
  const plan = await buildSyncPlanSnapshot(ownerUid, forceRemote);
  let pendingUploads = plan.plannedUploads;
  let pendingDownloads = plan.plannedDownloads;

  const remoteCadForLww = [
    ...plan.remoteCad,
    ...plan.remoteCadTombstones.map((t) => tombstonePayloadToSyncRecord(t, ownerUid) as CadastroItemPersist),
  ];
  const remoteSessForLww = [
    ...plan.remoteSess,
    ...plan.remoteSessTombstones.map((t) => tombstonePayloadToSyncRecord(t, ownerUid) as SessaoAplicacaoTaf),
  ];
  const remoteAppForLww = [
    ...plan.remoteApp,
    ...plan.remoteAppTombstones.map((t) => tombstonePayloadToSyncRecord(t, ownerUid) as AplicadorItemPersist),
  ];

  const drifts = [
    countActivePresenceDrift(plan.localCad, remoteCadForLww, remoteToCadastroRecord, ownerUid),
    countActivePresenceDrift(plan.localSess, remoteSessForLww, remoteToSessaoRecord, ownerUid),
    ...(isAuthorizedMemberSession()
      ? [{ extraDownloads: 0, extraUploads: 0 }]
      : [countActivePresenceDrift(plan.localApp, remoteAppForLww, remoteToAplicadorRecord, ownerUid)]),
    countBusinessContentDrift('cadastros', plan.localCad, plan.remoteCad, remoteToCadastroRecord, ownerUid),
    countBusinessContentDrift('sessoes', plan.localSess, plan.remoteSess, remoteToSessaoRecord, ownerUid),
  ];
  for (const drift of drifts) {
    pendingDownloads = Math.max(pendingDownloads, drift.extraDownloads);
    pendingUploads = Math.max(pendingUploads, drift.extraUploads);
  }

  const downloadBreakdown = buildDownloadBreakdown(plan.downloadItems, pendingDownloads);

  return { pendingUploads, pendingDownloads, downloadBreakdown };
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
  rubricCaches?: DownloadRubricCaches,
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

  const concurrency = phase === 'download' ? DOWNLOAD_CONCURRENCY : 1;
  let processed = 0;

  for (let offset = 0; offset < items.length; offset += concurrency) {
    const batch = items.slice(offset, offset + concurrency);
    progressCb?.({
      processed,
      total,
      message,
      stepId,
      pendingUploads: plannedUploads,
      pendingDownloads: plannedDownloads,
      phase,
    });

    await Promise.all(
      batch.map(async (item) => {
        try {
          await executePlanItem(ownerUid, item, uploadFns, stats, deletionAudits, rubricCaches);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          stats.errors.push(`${item.collection}/${item.id}: ${msg}`);
          const failedRecord = item.local?.deleted
            ? item.local
            : item.remote?.deleted
              ? item.remote
              : null;
          if (failedRecord?.deleted) {
            deletionAudits.push(
              buildDeletionAuditEntry(item.collection, failedRecord, phase, Date.now(), true),
            );
          }
        }
      }),
    );

    processed += batch.length;
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

  const plan = await buildSyncPlanSnapshot(ownerUid, true);
  const {
    downloadItems,
    uploadItems,
    plannedUploads,
    plannedDownloads,
    totalIgnored,
    localCad,
    localSess,
    localApp,
    localPre,
    remoteCad,
    remoteSess,
    remoteApp,
    remotePre,
    remoteCadTombstones,
    remoteSessTombstones,
    remoteAppTombstones,
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
    pre_cadastros: uploadPreCadastro as UploadFn,
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
      remotePre,
      uploadFns,
      stats,
      deletionAudits,
      progressCb,
      remoteCadTombstones,
      remoteSessTombstones,
      remoteAppTombstones,
    );
    const emailErrors = await pushPendingAuthorizedEmails(ownerUid);
    stats.errors.push(...emailErrors);
    await syncQueue.clearDone(ownerUid);
    await protectDirectPlaintextCloudDocs(ownerUid, stats, progressCb);

    await ensureNoPendingRemain(ownerUid, stats);

    const finishedAt = Date.now();
    const activeRemote = (rows: Array<{ deleted?: boolean }>) => rows.filter((r) => r.deleted !== true).length;
    const collectionCounts = {
      cadastros: { local: localCad.filter((r) => !r.deleted).length, remote: activeRemote(remoteCad) },
      sessoes: { local: localSess.filter((r) => !r.deleted).length, remote: activeRemote(remoteSess) },
      aplicadores: { local: localApp.filter((r) => !r.deleted).length, remote: activeRemote(remoteApp) },
      pre_cadastros: { local: localPre.filter((r) => !r.deleted).length, remote: activeRemote(remotePre) },
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

  const rubricCaches =
    downloadItems.length > 0
      ? await buildDownloadRubricCaches(ownerUid, downloadItems)
      : undefined;

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
    rubricCaches,
  );

  if (uploadItems.length > 0) {
    invalidateRemoteSnapshotCache();
  }

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
    remotePre,
    uploadFns,
    stats,
    deletionAudits,
    progressCb,
    remoteCadTombstones,
    remoteSessTombstones,
    remoteAppTombstones,
  );

  await protectDirectPlaintextCloudDocs(ownerUid, stats, progressCb);

  if (stats.errors.length === 0) {
    await runDeletionGarbageCollection(ownerUid, {
      remoteCad,
      remoteSess,
      remoteApp,
    });
  }

  await ensureNoPendingRemain(ownerUid, stats);

  const finishedAt = Date.now();
  const activeRemote = (rows: Array<{ deleted?: boolean }>) => rows.filter((r) => r.deleted !== true).length;
  const collectionCounts = {
    cadastros: { local: localCad.filter((r) => !r.deleted).length, remote: activeRemote(remoteCad) },
    sessoes: { local: localSess.filter((r) => !r.deleted).length, remote: activeRemote(remoteSess) },
    aplicadores: { local: localApp.filter((r) => !r.deleted).length, remote: activeRemote(remoteApp) },
    pre_cadastros: { local: localPre.filter((r) => !r.deleted).length, remote: activeRemote(remotePre) },
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
