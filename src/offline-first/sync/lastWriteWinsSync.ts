import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import {
  addCadastroFirestore,
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
import { ensureRecordMeta, markRecordSynced, readUpdatedAt } from './recordMeta';
import { appendSyncAudit, type SyncAuditEntry } from './syncAudit';
import { syncQueue } from './SyncQueue';

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
  const at = readUpdatedAt(remote) || Date.now();
  return ensureRecordMeta(
    {
      ...remote,
      ownerUid,
      createdAt: at,
      updatedAt: at,
      syncStatus: 'synced',
      deleted: false,
      deviceId: 'remote',
      userId: getCachedLoginUid(),
      lastModifiedBy: 'remote',
    } as CadastroRecord,
    ownerUid,
  );
}

function remoteToSessaoRecord(remote: SessaoAplicacaoTaf, ownerUid: string): SessaoRecord {
  const at = readUpdatedAt(remote) || Date.parse(remote.criadoEm) || Date.now();
  return ensureRecordMeta(
    {
      ...remote,
      ownerUid,
      createdAt: at,
      updatedAt: at,
      syncStatus: 'synced',
      deleted: false,
      deviceId: 'remote',
      userId: getCachedLoginUid(),
      lastModifiedBy: 'remote',
    } as SessaoRecord,
    ownerUid,
  );
}

function remoteToAplicadorRecord(remote: AplicadorItemPersist, ownerUid: string): AplicadorRecord {
  const at = readUpdatedAt(remote) || Date.now();
  return ensureRecordMeta(
    {
      ...remote,
      ownerUid,
      createdAt: at,
      updatedAt: at,
      syncStatus: 'synced',
      deleted: false,
      deviceId: 'remote',
      userId: getCachedLoginUid(),
      lastModifiedBy: 'remote',
    } as AplicadorRecord,
    ownerUid,
  );
}

async function uploadCadastro(uid: string, local: CadastroRecord, hasRemote: boolean): Promise<void> {
  if (local.deleted) {
    if (hasRemote) await deleteCadastroFirestore(uid, local.id);
    await putCadastroRecord(markRecordSynced(local, getCachedLoginUid()));
    return;
  }
  await addCadastroFirestore(uid, stripForFirestore(local) as CadastroItemPersist);
  await putCadastroRecord(markRecordSynced(local, getCachedLoginUid()));
}

async function uploadSessao(uid: string, local: SessaoRecord, hasRemote: boolean): Promise<void> {
  const payload = stripForFirestore(local) as SessaoAplicacaoTaf;
  if (local.deleted) {
    if (hasRemote) await deleteSessaoFirestore(uid, local.id);
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
    if (hasRemote) await deleteAplicadorFirestore(uid, local.id);
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
    ensureRecordMeta({ ...(local ?? {}), ...remote, ownerUid } as SyncRecord, ownerUid),
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
        continue;
      }

      if (decision.action === 'download' && remote) {
        await downloadRecord(collection, remote, local, ownerUid);
        stats.downloads += 1;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`${collection}/${id}: ${msg}`);
    }
  }
}

export async function executeLastWriteWinsSync(ownerUid: string): Promise<{
  success: boolean;
  stats: LwwSyncStats;
  audit: SyncAuditEntry;
}> {
  const startedAt = Date.now();
  const stats: LwwSyncStats = { uploads: 0, downloads: 0, ignored: 0, errors: [] };
  const deviceId = await getDeviceId();

  const [localCad, localSess, localApp, remoteCad, remoteSess, remoteApp] = await Promise.all([
    listCadastros(ownerUid, true),
    listSessoes(ownerUid, true),
    listAplicadores(ownerUid, true),
    getAllCadastrosFirestoreLight(ownerUid),
    getAllSessoesFirestoreLight(ownerUid),
    getAllAplicadoresFirestore(ownerUid),
  ]);

  await syncCollection('cadastros', ownerUid, localCad, remoteCad, remoteToCadastroRecord, uploadCadastro, stats);
  await syncCollection('sessoes', ownerUid, localSess, remoteSess, remoteToSessaoRecord, uploadSessao, stats);
  await syncCollection('aplicadores', ownerUid, localApp, remoteApp, remoteToAplicadorRecord, uploadAplicador, stats);

  await syncQueue.clearDone(ownerUid);

  const audit = await appendSyncAudit({
    ownerUid,
    userId: getCachedLoginUid(),
    deviceId,
    startedAt,
    finishedAt: Date.now(),
    uploads: stats.uploads,
    downloads: stats.downloads,
    ignored: stats.ignored,
    errors: stats.errors,
  });

  return {
    success: stats.errors.length === 0,
    stats,
    audit,
  };
}
