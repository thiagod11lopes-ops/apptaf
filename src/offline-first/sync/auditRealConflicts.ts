/**
 * Varredura e auditoria local de conflitos reais (sem alterar LWW).
 */

import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { CollectionName, SyncAuditEntry } from '../types';
import {
  listAplicadoresForSync,
  listCadastrosForSync,
  listSessoesForSync,
} from '../db/localDb';
import { getTafDatabase } from '../db/tafDatabase';
import { decideLastWriteWins, type SyncRecord } from './lastWriteWins';
import { remoteDocToSyncRecord } from './tombstone';
import { fetchRemoteCollectionsSnapshot } from './remoteSnapshotCache';
import { syncQueue } from './SyncQueue';
import { syncLogger } from './SyncLogger';
import { getDeviceId } from '../deviceId';
import { APP_VERSION } from '../appVersion';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import {
  detectRealConflict,
  type DetectRealConflictResult,
} from './detectRealConflict';

export type AuditedRealConflict = DetectRealConflictResult & {
  collection: CollectionName;
  recordId: string;
  detectedAt: number;
  /** Vencedor segundo LWW (somente auditoria — não altera sync). */
  lwwWinner: 'local' | 'remote' | 'equal' | 'skip';
  lwwAction: 'upload' | 'download' | 'skip';
  lwwReason: string;
};

function remoteToCadastro(remote: CadastroItemPersist, ownerUid: string): SyncRecord {
  return remoteDocToSyncRecord(remote as Record<string, unknown> & { id: string }, ownerUid);
}

function remoteToSessao(remote: SessaoAplicacaoTaf, ownerUid: string): SyncRecord {
  return remoteDocToSyncRecord(remote as Record<string, unknown> & { id: string }, ownerUid);
}

function remoteToAplicador(remote: AplicadorItemPersist, ownerUid: string): SyncRecord {
  return remoteDocToSyncRecord(remote as Record<string, unknown> & { id: string }, ownerUid);
}

async function localOperationIdMap(
  ownerUid: string,
): Promise<Map<string, string>> {
  const pending = await syncQueue.listPending(ownerUid, 2000);
  const map = new Map<string, string>();
  for (const item of pending) {
    map.set(`${item.collection}:${item.documentId}`, item.operationId);
  }
  return map;
}

function lwwAuditWinner(
  local: SyncRecord,
  remote: SyncRecord,
): Pick<AuditedRealConflict, 'lwwWinner' | 'lwwAction' | 'lwwReason'> {
  const decision = decideLastWriteWins(local, remote);
  if (decision.action === 'upload') {
    return { lwwWinner: 'local', lwwAction: 'upload', lwwReason: decision.reason };
  }
  if (decision.action === 'download') {
    return { lwwWinner: 'remote', lwwAction: 'download', lwwReason: decision.reason };
  }
  return { lwwWinner: 'skip', lwwAction: 'skip', lwwReason: decision.reason };
}

async function appendConflictChangeLog(entry: AuditedRealConflict): Promise<void> {
  await syncLogger.appendChangeLog({
    documentId: entry.recordId,
    collection: entry.collection,
    action: 'UPDATE',
    deviceId: entry.localDeviceId ?? (await getDeviceId()),
    userId: getCachedLoginUid(),
    previousVersion: entry.localVersion ?? 0,
    newVersion: entry.remoteVersion ?? 0,
    timestamp: entry.detectedAt,
    resolution: `lww_${entry.lwwWinner}`,
    details: JSON.stringify({
      kind: 'real_conflict_audit',
      conflictType: entry.conflictType,
      localUpdatedAt: entry.localUpdatedAt,
      remoteUpdatedAt: entry.remoteUpdatedAt,
      localDeviceId: entry.localDeviceId,
      remoteDeviceId: entry.remoteDeviceId,
      localOperationId: entry.localOperationId,
      remoteOperationId: entry.remoteOperationId,
      lwwAction: entry.lwwAction,
      lwwReason: entry.lwwReason,
    }),
  });
}

/**
 * Compara local×remoto e registra conflitos sem interferir no plano LWW.
 * Deve rodar antes de `runLastWriteWinsSync` (estado pré-resolução).
 */
export async function scanAndAuditRealConflicts(ownerUid: string): Promise<AuditedRealConflict[]> {
  if (!ownerUid.trim()) return [];

  const [localCad, localSess, localApp, remoteSnap, opMap] = await Promise.all([
    listCadastrosForSync(ownerUid, true),
    listSessoesForSync(ownerUid, true),
    listAplicadoresForSync(ownerUid, true),
    fetchRemoteCollectionsSnapshot(ownerUid, true),
    localOperationIdMap(ownerUid),
  ]);

  const found: AuditedRealConflict[] = [];
  const now = Date.now();

  const scanCollection = <TRemote extends { id: string }>(
    collection: CollectionName,
    localRows: SyncRecord[],
    remoteRows: TRemote[],
    toRemote: (remote: TRemote, ownerUid: string) => SyncRecord,
  ) => {
    const remoteMap = new Map(remoteRows.map((r) => [r.id, toRemote(r, ownerUid)]));
    for (const local of localRows) {
      const remote = remoteMap.get(local.id);
      if (!remote) continue;
      const detected = detectRealConflict({
        collection,
        local,
        remote,
        localOperationId: opMap.get(`${collection}:${local.id}`) ?? null,
        remoteOperationId: null,
      });
      if (!detected.hasConflict) continue;
      const lww = lwwAuditWinner(local, remote);
      found.push({
        ...detected,
        collection,
        recordId: local.id,
        detectedAt: now,
        ...lww,
      });
    }
  };

  scanCollection('cadastros', localCad, remoteSnap.remoteCad, remoteToCadastro);
  scanCollection('sessoes', localSess, remoteSnap.remoteSess, remoteToSessao);
  scanCollection('aplicadores', localApp, remoteSnap.remoteApp, remoteToAplicador);

  for (const conflict of found) {
    await appendConflictChangeLog(conflict);
    await syncLogger.warn('audit', `Conflito real detectado (${conflict.conflictType})`, {
      collection: conflict.collection,
      recordId: conflict.recordId,
      localVersion: conflict.localVersion,
      remoteVersion: conflict.remoteVersion,
      localUpdatedAt: conflict.localUpdatedAt,
      remoteUpdatedAt: conflict.remoteUpdatedAt,
      localDeviceId: conflict.localDeviceId,
      remoteDeviceId: conflict.remoteDeviceId,
      localOperationId: conflict.localOperationId,
      lwwWinner: conflict.lwwWinner,
      lwwAction: conflict.lwwAction,
      lwwReason: conflict.lwwReason,
    });
  }

  if (found.length > 0) {
    await syncLogger.info(
      'audit',
      `${found.length} conflito(s) real(is) auditado(s); LWW segue decidindo o vencedor.`,
      { ownerUid, count: found.length },
    );
  }

  return found;
}

/**
 * Anexa conflitos detectados ao registro de auditoria da sync (Dexie),
 * sem nova tabela e sem alterar o schema remoto.
 */
export async function attachRealConflictsToSyncAudit(
  audit: SyncAuditEntry,
  conflicts: AuditedRealConflict[],
): Promise<SyncAuditEntry> {
  if (!conflicts.length) return audit;

  const enriched: SyncAuditEntry & {
    realConflictCount?: number;
    realConflicts?: Array<Record<string, unknown>>;
  } = {
    ...audit,
    realConflictCount: conflicts.length,
    realConflicts: conflicts.map((c) => ({
      collection: c.collection,
      recordId: c.recordId,
      detectedAt: c.detectedAt,
      conflictType: c.conflictType,
      localVersion: c.localVersion,
      remoteVersion: c.remoteVersion,
      localUpdatedAt: c.localUpdatedAt,
      remoteUpdatedAt: c.remoteUpdatedAt,
      localDeviceId: c.localDeviceId,
      remoteDeviceId: c.remoteDeviceId,
      localOperationId: c.localOperationId,
      remoteOperationId: c.remoteOperationId,
      lwwWinner: c.lwwWinner,
      lwwAction: c.lwwAction,
      lwwReason: c.lwwReason,
      appVersion: APP_VERSION,
    })),
  };

  const db = getTafDatabase();
  if (db && audit.id != null) {
    await db.syncAuditHistory.update(audit.id, {
      realConflictCount: enriched.realConflictCount,
      realConflicts: enriched.realConflicts,
    } as Partial<SyncAuditEntry>);
  }

  return enriched as SyncAuditEntry;
}
