import type { SyncStatus } from '../types';

/** Status legado ainda presente em registros antigos. */
export const LEGACY_PENDING: SyncStatus = 'pending';

/** Registro criado localmente e ainda não sincronizado. */
export const STATUS_LOCAL: SyncStatus = 'local';

/** Registro alterado localmente após última sync. */
export const STATUS_UPDATED: SyncStatus = 'updated';

/** Registro excluído localmente (soft delete) aguardando sync. */
export const STATUS_DELETED: SyncStatus = 'deleted';

/** Registro alinhado com a nuvem. */
export const STATUS_SYNCED: SyncStatus = 'synced';

/** @deprecated LWW — normalizado para updated */
export const STATUS_CONFLICT: SyncStatus = 'conflict';

const UNSYNCED: ReadonlySet<SyncStatus> = new Set([
  LEGACY_PENDING,
  STATUS_LOCAL,
  STATUS_UPDATED,
  STATUS_DELETED,
]);

export function isUnsyncedLocalStatus(status: SyncStatus | string | undefined): boolean {
  return UNSYNCED.has(status as SyncStatus) || status === STATUS_CONFLICT;
}

export function syncStatusForOperation(operation: 'CREATE' | 'UPDATE' | 'DELETE'): SyncStatus {
  if (operation === 'CREATE') return STATUS_LOCAL;
  if (operation === 'DELETE') return STATUS_DELETED;
  return STATUS_UPDATED;
}

/** Normaliza status legado para o modelo atual. */
export function normalizeSyncStatus(status: SyncStatus | string | undefined): SyncStatus {
  if (status === LEGACY_PENDING || status === STATUS_CONFLICT) return STATUS_UPDATED;
  if (
    status === STATUS_LOCAL ||
    status === STATUS_UPDATED ||
    status === STATUS_DELETED ||
    status === STATUS_SYNCED ||
    status === 'failed'
  ) {
    return status as SyncStatus;
  }
  return STATUS_UPDATED;
}
