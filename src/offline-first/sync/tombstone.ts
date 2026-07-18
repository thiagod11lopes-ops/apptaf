import type { AplicadorRecord, CadastroRecord, CollectionName, SessaoRecord } from '../types';
import { ensureRecordMeta, readSyncVersion, readUpdatedAt } from './recordMeta';
import type { SyncRecord } from './lastWriteWins';

/** Campos de tombstone persistidos no Firestore. */
export type FirestoreTombstoneFields = {
  deleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
  syncVersion?: number;
  updatedBy?: string;
  deviceId?: string;
};

export type TombstonePayload = FirestoreTombstoneFields & {
  id: string;
  updatedAt: number;
};

export function readRemoteDeleted(record: Partial<FirestoreTombstoneFields> | null | undefined): boolean {
  return record?.deleted === true;
}

/** Converte documento remoto (Firestore) em registro Dexie com metadados de sync. */
export function remoteDocToSyncRecord<T extends SyncRecord>(
  remote: Record<string, unknown> & { id: string },
  ownerUid: string,
  defaults?: Partial<T>,
): T {
  const at = readUpdatedAt(remote as Partial<SyncRecord>);
  const deleted = readRemoteDeleted(remote);
  const sv = readSyncVersion(remote as Partial<SyncRecord>);

  return ensureRecordMeta(
    {
      ...defaults,
      ...remote,
      ownerUid,
      createdAt: (remote.createdAt as number | undefined) ?? at,
      updatedAt: at,
      syncVersion: sv,
      version: sv,
      syncStatus: 'synced',
      deleted,
      deletedAt: deleted ? (remote.deletedAt as number | undefined) ?? at : undefined,
      deletedBy: deleted ? (remote.deletedBy as string | undefined) : undefined,
      deviceId: (remote.deviceId as string | undefined) ?? 'remote',
      userId: (remote.updatedBy as string | undefined) ?? null,
      updatedBy: (remote.updatedBy as string | undefined) ?? 'remote',
      lastModifiedBy: (remote.deviceId as string | undefined) ?? 'remote',
    } as T,
    ownerUid,
  );
}

/**
 * Contrato único do documento de tombstone enviado à nuvem.
 * Todas as coleções (cadastros, sessões, aplicadores) devem usar exatamente estes campos.
 */
export function tombstoneToCloudDoc(tombstone: TombstonePayload): TombstonePayload {
  return {
    id: tombstone.id,
    updatedAt: tombstone.updatedAt,
    deleted: true,
    deletedAt: tombstone.deletedAt ?? tombstone.updatedAt,
    deletedBy: tombstone.deletedBy,
    syncVersion: tombstone.syncVersion,
    updatedBy: tombstone.updatedBy,
    deviceId: tombstone.deviceId,
  };
}

/** Payload mínimo para marcar exclusão na nuvem (tombstone). */
export function buildFirestoreTombstone(record: SyncRecord): TombstonePayload {
  return {
    id: record.id,
    updatedAt: record.updatedAt,
    deleted: true,
    deletedAt: record.deletedAt ?? record.updatedAt,
    deletedBy: record.deletedBy ?? record.updatedBy ?? record.userId ?? undefined,
    syncVersion: readSyncVersion(record),
    updatedBy: record.updatedBy ?? record.userId ?? undefined,
    deviceId: record.deviceId,
  };
}

export const DELETION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function isEligibleForLocalGarbageCollection(
  record: SyncRecord,
  pendingDocumentIds: Set<string>,
  collection: CollectionName,
  now = Date.now(),
): boolean {
  if (!record.deleted) return false;
  if (record.syncStatus !== 'synced') return false;
  const deletedAt = record.deletedAt ?? record.updatedAt;
  if (!deletedAt || now - deletedAt < DELETION_RETENTION_MS) return false;
  if (pendingDocumentIds.has(`${collection}:${record.id}`)) return false;
  return true;
}

export type DeletionAuditEntry = {
  collection: CollectionName;
  recordId: string;
  userId: string | null;
  originDeviceId: string;
  deletedAt: number;
  syncedAt: number;
  syncDirection: 'upload' | 'download';
  syncResult: 'SUCCESS' | 'FAILED';
};
