import type { CadastroRecord, SessaoRecord, AplicadorRecord, PreCadastroRecord } from '../types';
import { readSyncVersion, readUpdatedAt } from './recordMeta';

export type SyncRecord = CadastroRecord | SessaoRecord | AplicadorRecord | PreCadastroRecord;

export type LwwAction = 'upload' | 'download' | 'skip';

export type LwwDecision = {
  action: LwwAction;
  reason: string;
};

/** Ignora registro quando updatedAt e syncVersion são idênticos. */
export function shouldSkipIdenticalRecords(
  local: Partial<SyncRecord> | null | undefined,
  remote: Partial<SyncRecord> | null | undefined,
): boolean {
  if (!local || !remote) return false;
  if (local.deleted === true !== remote.deleted === true) return false;
  const localAt = readUpdatedAt(local);
  const remoteAt = readUpdatedAt(remote);
  if (localAt !== remoteAt) return false;
  return readSyncVersion(local) === readSyncVersion(remote);
}

/**
 * Last Write Wins — compara exclusivamente updatedAt.
 * Empate → skip (nenhum lado substitui o outro).
 */
export function decideLastWriteWins(
  local: Partial<SyncRecord> | null | undefined,
  remote: Partial<SyncRecord> | null | undefined,
): LwwDecision {
  if (!local && !remote) {
    return { action: 'skip', reason: 'registro_inexistente' };
  }

  if (!remote) {
    if (!local) {
      return { action: 'skip', reason: 'registro_inexistente' };
    }
    return { action: 'upload', reason: 'somente_local' };
  }

  if (!local) {
    return { action: 'download', reason: 'somente_remoto' };
  }

  if (shouldSkipIdenticalRecords(local, remote)) {
    return { action: 'skip', reason: 'updatedAt_e_syncVersion_iguais' };
  }

  const localAt = readUpdatedAt(local);
  const remoteAt = readUpdatedAt(remote);
  const localDeleted = local.deleted === true;
  const remoteDeleted = remote.deleted === true;

  if (localAt === remoteAt && localDeleted !== remoteDeleted) {
    if (remoteDeleted) {
      return { action: 'download', reason: 'exclusao_remota_empate' };
    }
    return { action: 'upload', reason: 'exclusao_local_empate' };
  }

  if (localAt > remoteAt) {
    return { action: 'upload', reason: 'local_updatedAt_mais_recente' };
  }
  if (remoteAt > localAt) {
    return { action: 'download', reason: 'remoto_updatedAt_mais_recente' };
  }

  const localSv = readSyncVersion(local);
  const remoteSv = readSyncVersion(remote);
  if (localSv > remoteSv) {
    return { action: 'upload', reason: 'local_syncVersion_maior_empate' };
  }
  if (remoteSv > localSv) {
    return { action: 'download', reason: 'remoto_syncVersion_maior_empate' };
  }

  return { action: 'skip', reason: 'updatedAt_empate' };
}

/** Compatibilidade com código legado — delega para LWW. */
export function resolveLastWriteWins<T extends SyncRecord>(local: T, remote: T): {
  winner: 'local' | 'remote' | 'equal';
  record: T;
  action: LwwAction;
  reason: string;
} {
  const decision = decideLastWriteWins(local, remote);
  if (decision.action === 'upload') {
    return { winner: 'local', record: local, action: decision.action, reason: decision.reason };
  }
  if (decision.action === 'download') {
    return { winner: 'remote', record: remote, action: decision.action, reason: decision.reason };
  }
  const winner = readUpdatedAt(local) >= readUpdatedAt(remote) ? 'local' : 'remote';
  return {
    winner: readUpdatedAt(local) === readUpdatedAt(remote) ? 'equal' : winner,
    record: readUpdatedAt(local) >= readUpdatedAt(remote) ? local : remote,
    action: 'skip',
    reason: decision.reason,
  };
}
