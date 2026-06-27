import { getTafDatabase } from '../db/tafDatabase';
import {
  listAplicadores,
  listCadastros,
  listSessoes,
} from '../db/localDb';
import { listPreCadastros } from '../db/preCadastroLocalDb';
import { syncQueue } from './SyncQueue';
import {
  isEligibleForLocalGarbageCollection,
  readRemoteDeleted,
  type DeletionAuditEntry,
} from './tombstone';
import type { CollectionName } from '../types';
import type { SyncRecord } from './lastWriteWins';
import {
  purgeAplicadorFirestore,
  purgeCadastroFirestore,
  purgeSessaoFirestore,
} from './firebase/FirebaseGateway';
import { getAllCadastrosFirestoreLight, getAllSessoesFirestoreLight, getAllAplicadoresFirestore } from './firebase/FirebaseGateway';

async function pendingDocumentKeys(ownerUid: string): Promise<Set<string>> {
  const pending = await syncQueue.listPending(ownerUid);
  const keys = new Set<string>();
  for (const item of pending) {
    keys.add(`${item.collection}:${item.documentId}`);
  }
  return keys;
}

async function purgeLocalCollection(
  ownerUid: string,
  collection: CollectionName,
  includeDeleted: true,
): Promise<number> {
  const db = getTafDatabase();
  if (!db) return 0;

  const pendingKeys = await pendingDocumentKeys(ownerUid);
  const rows =
    collection === 'cadastros'
      ? await listCadastros(ownerUid, includeDeleted)
      : collection === 'sessoes'
        ? await listSessoes(ownerUid, includeDeleted)
        : collection === 'pre_cadastros'
          ? await listPreCadastros(ownerUid, includeDeleted)
          : await listAplicadores(ownerUid, includeDeleted);

  let purged = 0;
  for (const row of rows) {
    if (!isEligibleForLocalGarbageCollection(row as SyncRecord, pendingKeys, collection)) continue;
    if (collection === 'cadastros') await db.cadastros.delete(row.id);
    else if (collection === 'sessoes') await db.sessoes.delete(row.id);
    else if (collection === 'pre_cadastros') await db.preCadastros.delete(row.id);
    else await db.aplicadores.delete(row.id);
    purged += 1;
  }
  return purged;
}

async function purgeRemoteTombstones(ownerUid: string): Promise<number> {
  const [remoteCad, remoteSess, remoteApp] = await Promise.all([
    getAllCadastrosFirestoreLight(ownerUid),
    getAllSessoesFirestoreLight(ownerUid),
    getAllAplicadoresFirestore(ownerUid),
  ]);

  let purged = 0;
  const now = Date.now();

  for (const row of remoteCad) {
    if (!readRemoteDeleted(row)) continue;
    const deletedAt = (row as { deletedAt?: number }).deletedAt ?? row.updatedAt ?? 0;
    if (!deletedAt || now - deletedAt < 30 * 24 * 60 * 60 * 1000) continue;
    await purgeCadastroFirestore(ownerUid, row.id);
    purged += 1;
  }
  for (const row of remoteSess) {
    if (!readRemoteDeleted(row)) continue;
    const deletedAt = (row as { deletedAt?: number }).deletedAt ?? row.updatedAt ?? 0;
    if (!deletedAt || now - deletedAt < 30 * 24 * 60 * 60 * 1000) continue;
    await purgeSessaoFirestore(ownerUid, row.id);
    purged += 1;
  }
  for (const row of remoteApp) {
    if (!readRemoteDeleted(row)) continue;
    const deletedAt = (row as { deletedAt?: number }).deletedAt ?? row.updatedAt ?? 0;
    if (!deletedAt || now - deletedAt < 30 * 24 * 60 * 60 * 1000) continue;
    await purgeAplicadorFirestore(ownerUid, row.id);
    purged += 1;
  }

  return purged;
}

/** Garbage collection — remove fisicamente tombstones sincronizados após retenção. */
export async function runDeletionGarbageCollection(ownerUid: string): Promise<{
  localPurged: number;
  remotePurged: number;
}> {
  const [localCad, localSess, localApp, localPre] = await Promise.all([
    purgeLocalCollection(ownerUid, 'cadastros', true),
    purgeLocalCollection(ownerUid, 'sessoes', true),
    purgeLocalCollection(ownerUid, 'aplicadores', true),
    purgeLocalCollection(ownerUid, 'pre_cadastros', true),
  ]);

  let remotePurged = 0;
  try {
    remotePurged = await purgeRemoteTombstones(ownerUid);
  } catch {
    // GC remoto é best-effort — não falha a sync
  }

  return {
    localPurged: localCad + localSess + localApp + localPre,
    remotePurged,
  };
}

export function buildDeletionAuditEntry(
  collection: CollectionName,
  record: SyncRecord,
  direction: 'upload' | 'download',
  syncedAt: number,
  failed = false,
): DeletionAuditEntry {
  return {
    collection,
    recordId: record.id,
    userId: record.userId ?? record.updatedBy ?? null,
    originDeviceId: record.deviceId,
    deletedAt: record.deletedAt ?? record.updatedAt,
    syncedAt,
    syncDirection: direction,
    syncResult: failed ? 'FAILED' : 'SUCCESS',
  };
}
