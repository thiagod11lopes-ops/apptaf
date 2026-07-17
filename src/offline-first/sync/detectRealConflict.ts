/**
 * Detecção de conflitos reais (somente auditoria).
 * Não altera LWW nem o plano de sincronização.
 */

import type { CollectionName } from '../types';
import type { SyncRecord } from './lastWriteWins';
import { shouldSkipIdenticalRecords } from './lastWriteWins';
import { readSyncVersion, readUpdatedAt } from './recordMeta';
import { syncBusinessContentEqual } from './syncBusinessContent';
import { isUnsyncedLocalStatus } from './syncStatus';

export type DetectRealConflictInput = {
  collection: CollectionName;
  local: SyncRecord | null | undefined;
  remote: SyncRecord | null | undefined;
  /** operationId da fila local (se houver). */
  localOperationId?: string | null;
  /** operationId remoto — normalmente indisponível na nuvem atual. */
  remoteOperationId?: string | null;
};

export type DetectRealConflictResult = {
  hasConflict: boolean;
  conflictType: string;
  localVersion: number | null;
  remoteVersion: number | null;
  localUpdatedAt: number | null;
  remoteUpdatedAt: number | null;
  localDeviceId: string | null;
  remoteDeviceId: string | null;
  localOperationId: string | null;
  remoteOperationId: string | null;
};

const NO_CONFLICT: DetectRealConflictResult = {
  hasConflict: false,
  conflictType: 'none',
  localVersion: null,
  remoteVersion: null,
  localUpdatedAt: null,
  remoteUpdatedAt: null,
  localDeviceId: null,
  remoteDeviceId: null,
  localOperationId: null,
  remoteOperationId: null,
};

function readDeviceId(record: Partial<SyncRecord> | null | undefined): string | null {
  const id = record?.deviceId?.trim();
  if (!id || id === 'legacy' || id === 'remote') return id ?? null;
  return id;
}

/**
 * Indica se o remoto parece ter avançado após a última sync conhecida do local.
 * Sem `lastSync`, usa divergência de updatedAt/syncVersion (não trata local-ahead puro).
 */
export function remoteAdvancedSinceLastKnownSync(
  local: SyncRecord,
  remote: SyncRecord,
): boolean {
  const remoteAt = readUpdatedAt(remote);
  const localAt = readUpdatedAt(local);
  const lastSync = typeof local.lastSync === 'number' && local.lastSync > 0 ? local.lastSync : null;

  if (lastSync != null) {
    return remoteAt > lastSync;
  }

  const localSv = readSyncVersion(local);
  const remoteSv = readSyncVersion(remote);

  // Local à frente e remoto parece ancestral → pendência simples, não concorrência.
  if (remoteAt < localAt && remoteSv <= localSv) {
    return false;
  }

  return remoteAt !== localAt || remoteSv !== localSv;
}

function versionsRepresentDifferentState(local: SyncRecord, remote: SyncRecord): boolean {
  if (local.deleted === true !== remote.deleted === true) return true;
  if (readUpdatedAt(local) !== readUpdatedAt(remote)) return true;
  if (readSyncVersion(local) !== readSyncVersion(remote)) return true;
  return false;
}

/**
 * Detecta edição concorrente local×remoto.
 * Puro: sem I/O, sem efeito colateral, sem alterar decisão LWW.
 */
export function detectRealConflict(input: DetectRealConflictInput): DetectRealConflictResult {
  const { collection, local, remote } = input;
  const base: DetectRealConflictResult = {
    ...NO_CONFLICT,
    localVersion: local ? readSyncVersion(local) : null,
    remoteVersion: remote ? readSyncVersion(remote) : null,
    localUpdatedAt: local ? readUpdatedAt(local) : null,
    remoteUpdatedAt: remote ? readUpdatedAt(remote) : null,
    localDeviceId: local ? readDeviceId(local) : null,
    remoteDeviceId: remote ? readDeviceId(remote) : null,
    localOperationId: input.localOperationId ?? null,
    remoteOperationId: input.remoteOperationId ?? null,
  };

  if (!local || !remote) {
    return { ...base, conflictType: 'missing_side' };
  }

  // 1) Alteração local pendente
  if (!isUnsyncedLocalStatus(local.syncStatus)) {
    return { ...base, conflictType: 'local_already_synced' };
  }

  // 5) Mesmo estado (meta idêntica) — não é conflito
  if (shouldSkipIdenticalRecords(local, remote)) {
    return { ...base, conflictType: 'identical_meta' };
  }

  // 4) Conteúdo de negócio igual — atualização repetida / só meta
  if (syncBusinessContentEqual(collection, local, remote)) {
    return { ...base, conflictType: 'same_business_content' };
  }

  // 2) Remoto avançou após última sync conhecida
  if (!remoteAdvancedSinceLastKnownSync(local, remote)) {
    return { ...base, conflictType: 'remote_not_advanced' };
  }

  // 3) Versões/timestamps representam estados diferentes
  if (!versionsRepresentDifferentState(local, remote)) {
    return { ...base, conflictType: 'same_version_markers' };
  }

  const conflictType =
    local.deleted === true || remote.deleted === true
      ? 'concurrent_edit_with_delete'
      : 'concurrent_edit';

  return {
    ...base,
    hasConflict: true,
    conflictType,
  };
}
