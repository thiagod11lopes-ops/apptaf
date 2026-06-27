import type { CadastroRecord, SessaoRecord, AplicadorRecord, SyncStatus } from '../types';
import { STATUS_SYNCED, syncStatusForOperation } from './syncStatus';

type SyncRecord = CadastroRecord | SessaoRecord | AplicadorRecord;

export function readUpdatedAt(record: Partial<SyncRecord> | null | undefined): number {
  if (typeof record?.updatedAt === 'number' && record.updatedAt > 0) return record.updatedAt;
  if ('criadoEm' in (record ?? {}) && record?.criadoEm) {
    const parsed = Date.parse(String(record.criadoEm));
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof record?.createdAt === 'number' && record.createdAt > 0) return record.createdAt;
  return 0;
}

export function readSyncVersion(record: Partial<SyncRecord> | null | undefined): number {
  if (typeof record?.syncVersion === 'number' && record.syncVersion > 0) return record.syncVersion;
  if (typeof record?.version === 'number' && record.version > 0) return record.version;
  return 1;
}

/** Garante metadados mínimos em registros legados. */
export function ensureRecordMeta<T extends SyncRecord>(record: T, ownerUid: string): T {
  const now = readUpdatedAt(record) || Date.now();
  const sv = readSyncVersion(record);
  return {
    ...record,
    ownerUid: record.ownerUid || ownerUid,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    syncVersion: sv,
    version: record.version ?? sv,
    deviceId: record.deviceId || 'legacy',
    userId: record.userId ?? null,
    updatedBy: record.updatedBy ?? record.userId ?? record.lastModifiedBy ?? 'legacy',
    lastModifiedBy: record.lastModifiedBy || record.deviceId || 'legacy',
    syncStatus: record.syncStatus ?? STATUS_SYNCED,
    deleted: record.deleted ?? false,
  };
}

/**
 * Atualiza metadados em toda gravação local.
 * updatedAt = UTC atual; syncVersion incrementado; syncStatus conforme operação.
 */
export function bumpRecordMeta<T extends SyncRecord>(
  record: T,
  deviceId: string,
  userId: string | null,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
): T {
  const now = Date.now();
  const nextSyncVersion = operation === 'CREATE' ? 1 : readSyncVersion(record) + 1;

  if (operation === 'DELETE') {
    return {
      ...record,
      deleted: true,
      deletedAt: now,
      deletedBy: userId ?? deviceId,
      updatedAt: now,
      syncVersion: nextSyncVersion,
      version: nextSyncVersion,
      deviceId,
      userId,
      updatedBy: userId ?? deviceId,
      syncStatus: syncStatusForOperation('DELETE'),
      lastModifiedBy: deviceId,
    };
  }

  return {
    ...record,
    deleted: false,
    deletedAt: undefined,
    deletedBy: undefined,
    createdAt: record.createdAt || now,
    updatedAt: now,
    syncVersion: nextSyncVersion,
    version: nextSyncVersion,
    deviceId,
    userId,
    updatedBy: userId ?? deviceId,
    syncStatus: syncStatusForOperation(operation) as SyncStatus,
    lastModifiedBy: deviceId,
  };
}

/** Marca registro como sincronizado após upload/download bem-sucedido. */
export function markRecordSynced<T extends SyncRecord>(record: T, userId?: string | null): T {
  const now = Date.now();
  return {
    ...record,
    syncStatus: STATUS_SYNCED,
    lastSync: now,
    updatedBy: userId ?? record.updatedBy ?? record.userId ?? record.lastModifiedBy,
  };
}
