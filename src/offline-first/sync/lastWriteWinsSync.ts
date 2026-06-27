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
  listAplicadores,
  listCadastros,
  listSessoes,
  putAplicadorRecord,
  putCadastroRecord,
  putSessaoRecord,
} from '../db/localDb';
import { decideLastWriteWins, type SyncRecord } from './lastWriteWins';
import { markRecordSynced } from './recordMeta';
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

export type LwwSyncStats = {
  uploads: number;
  downloads: number;
  ignored: number;
  errors: string[];
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

async function uploadCadastro(uid: string, local: CadastroRecord, hasRemote: boolean): Promise<void> {
  if (local.deleted) {
    await deleteCadastroFirestore(uid, local.id, buildFirestoreTombstone(local));
    await putCadastroRecord(markRecordSynced(local, getCachedLoginUid()));
    return;
  }
  await addCadastroFirestore(uid, stripForFirestore(local) as CadastroItemPersist);
  await putCadastroRecord(markRecordSynced(local, getCachedLoginUid()));
}

async function uploadSessao(uid: string, local: SessaoRecord, hasRemote: boolean): Promise<void> {
  const payload = stripForFirestore(local) as SessaoAplicacaoTaf;
  if (local.deleted) {
    await deleteSessaoFirestore(uid, local.id, buildFirestoreTombstone(local));
    await putSessaoRecord(markRecordSynced(local, getCachedLoginUid()));
    return;
  }
  if (hasRemote) {
    await updateSessaoFirestore(uid, payload);
  } else {
    await addSessaoFirestore(uid, payload);
  }
  await putSessaoRecord(markRecordSynced(local, getCachedLoginUid()));
}

async function uploadAplicador(uid: string, local: AplicadorRecord, hasRemote: boolean): Promise<void> {
  if (local.deleted) {
    await deleteAplicadorFirestore(uid, local.id, buildFirestoreTombstone(local));
    await putAplicadorRecord(markRecordSynced(local, getCachedLoginUid()));
    return;
  }
  await addAplicadorFirestore(uid, stripForFirestore(local) as AplicadorItemPersist);
  await putAplicadorRecord(markRecordSynced(local, getCachedLoginUid()));
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

async function syncCollection<TLocal extends SyncRecord, TRemote extends { id: string }>(
  collection: CollectionName,
  ownerUid: string,
  localRows: TLocal[],
  remoteRows: TRemote[],
  toRecord: (remote: TRemote, ownerUid: string) => SyncRecord,
  upload: (uid: string, local: TLocal, hasRemote: boolean) => Promise<void>,
  stats: LwwSyncStats,
  deletionAudits: DeletionAuditEntry[],
): Promise<void> {
  const localMap = new Map(localRows.map((r) => [r.id, r]));
  const remoteMap = new Map(remoteRows.map((r) => [r.id, toRecord(r, ownerUid)]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    const hasRemote = remoteMap.has(id);
    const decision = decideLastWriteWins(local, remote);

    try {
      if (decision.action === 'skip') {
        stats.ignored += 1;
        continue;
      }

      if (decision.action === 'upload' && local) {
        await upload(ownerUid, local, hasRemote);
        stats.uploads += 1;
        if (local.deleted) {
          deletionAudits.push(buildDeletionAuditEntry(collection, local, 'upload', Date.now()));
        }
        continue;
      }

      if (decision.action === 'download' && remote) {
        await downloadRecord(collection, remote, local, ownerUid);
        stats.downloads += 1;
        if (remote.deleted) {
          deletionAudits.push(buildDeletionAuditEntry(collection, remote, 'download', Date.now()));
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`${collection}/${id}: ${msg}`);
      const failedRecord = local?.deleted ? local : remote?.deleted ? remote : null;
      if (failedRecord?.deleted) {
        deletionAudits.push(
          buildDeletionAuditEntry(
            collection,
            failedRecord,
            decision.action === 'upload' ? 'upload' : 'download',
            Date.now(),
            true,
          ),
        );
      }
    }
  }
}

export async function executeLastWriteWinsSync(
  ownerUid: string,
  options?: {
    backupId?: number | null;
    clockDrift?: ClockDriftResult;
    userEmail?: string | null;
  },
): Promise<{
  success: boolean;
  stats: LwwSyncStats;
  audit: SyncAuditEntry;
}> {
  const startedAt = Date.now();
  const stats: LwwSyncStats = { uploads: 0, downloads: 0, ignored: 0, errors: [] };
  const deletionAudits: DeletionAuditEntry[] = [];
  const deviceId = await getDeviceId();

  const [localCad, localSess, localApp, remoteCad, remoteSess, remoteApp] = await Promise.all([
    listCadastros(ownerUid, true),
    listSessoes(ownerUid, true),
    listAplicadores(ownerUid, true),
    getAllCadastrosFirestoreLight(ownerUid),
    getAllSessoesFirestoreLight(ownerUid),
    getAllAplicadoresFirestore(ownerUid),
  ]);

  await syncCollection('cadastros', ownerUid, localCad, remoteCad, remoteToCadastroRecord, uploadCadastro, stats, deletionAudits);
  await syncCollection('sessoes', ownerUid, localSess, remoteSess, remoteToSessaoRecord, uploadSessao, stats, deletionAudits);
  await syncCollection('aplicadores', ownerUid, localApp, remoteApp, remoteToAplicadorRecord, uploadAplicador, stats, deletionAudits);

  const emailErrors = await pushPendingAuthorizedEmails(ownerUid);
  stats.errors.push(...emailErrors);

  await syncQueue.clearDone(ownerUid);

  if (stats.errors.length === 0) {
    await runDeletionGarbageCollection(ownerUid);
  }

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
  };
}
