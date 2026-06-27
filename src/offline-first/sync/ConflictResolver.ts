import type { CadastroRecord, SessaoRecord, AplicadorRecord } from '../types';
export { bumpRecordMeta, markRecordSynced, readUpdatedAt, readSyncVersion, ensureRecordMeta } from './recordMeta';
export { decideLastWriteWins, resolveLastWriteWins, shouldSkipIdenticalRecords } from './lastWriteWins';
export type { LwwAction, LwwDecision } from './lastWriteWins';
import { resolveLastWriteWins } from './lastWriteWins';

type SyncRecord = CadastroRecord | SessaoRecord | AplicadorRecord;

/**
 * @deprecated Use decideLastWriteWins / resolveLastWriteWins.
 * Mantido para compatibilidade — delega para Last Write Wins (sem tela de conflitos).
 */
export function resolveRecordConflict<T extends SyncRecord>(local: T, remote: T) {
  const result = resolveLastWriteWins(local, remote);
  return {
    winner: result.winner === 'equal' ? ('local' as const) : result.winner,
    record: result.record,
    hadConflict: false,
    reason: result.reason,
  };
}
