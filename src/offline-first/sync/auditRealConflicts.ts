/**
 * Varredura e auditoria local de conflitos reais (sem alterar LWW).
 * Persiste somente metadados e hashes SHA-256, nunca conteúdo de negócio.
 */

import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type {
  CollectionName,
  RealConflictAuditEntry,
  SyncAuditEntry,
} from '../types';
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
import { getCachedLoginUid } from '../../services/firebase/authUid';
import {
  detectRealConflict,
  type DetectRealConflictResult,
} from './detectRealConflict';
import { hashConflictContent, sha256Text } from './conflictAuditHash';

export type AuditedRealConflict = RealConflictAuditEntry & {
  /** Evita duplicar changeLog/SyncLogger em retries do mesmo conflito. */
  isNewAudit: boolean;
};

function randomConflictId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readUserId(record: Partial<SyncRecord>): string | null {
  const value = record.updatedBy ?? record.userId;
  if (!value || value === 'legacy' || value === 'remote') return null;
  return value;
}

function remoteToCadastro(remote: CadastroItemPersist, ownerUid: string): SyncRecord {
  return remoteDocToSyncRecord(remote as Record<string, unknown> & { id: string }, ownerUid);
}

function remoteToSessao(remote: SessaoAplicacaoTaf, ownerUid: string): SyncRecord {
  return remoteDocToSyncRecord(remote as Record<string, unknown> & { id: string }, ownerUid);
}

function remoteToAplicador(remote: AplicadorItemPersist, ownerUid: string): SyncRecord {
  return remoteDocToSyncRecord(remote as Record<string, unknown> & { id: string }, ownerUid);
}

async function localOperationIdMap(ownerUid: string): Promise<Map<string, string>> {
  const pending = await syncQueue.listPending(ownerUid, 2000);
  const map = new Map<string, string>();
  for (const item of pending) {
    map.set(`${item.collection}:${item.documentId}`, item.operationId);
  }
  return map;
}

function decideAuditResult(
  local: SyncRecord,
  remote: SyncRecord,
): RealConflictAuditEntry['result'] {
  const decision = decideLastWriteWins(local, remote);
  if (decision.action === 'upload') {
    return {
      winner: 'local',
      loser: 'remote',
      action: 'upload',
      reason: decision.reason,
    };
  }
  if (decision.action === 'download') {
    return {
      winner: 'remote',
      loser: 'local',
      action: 'download',
      reason: decision.reason,
    };
  }

  // detectRealConflict não classifica empate completo como conflito.
  // Fallback defensivo mantém a mesma preferência efetiva do LWW.
  return {
    winner: 'local',
    loser: 'remote',
    action: 'upload',
    reason: decision.reason,
  };
}

export async function buildRealConflictAuditEntry(params: {
  collection: CollectionName;
  recordId: string;
  detected: DetectRealConflictResult;
  local: SyncRecord;
  remote: SyncRecord;
  detectedAt?: number;
}): Promise<RealConflictAuditEntry> {
  const { collection, recordId, detected, local, remote } = params;
  const detectedAt = params.detectedAt ?? Date.now();
  const [localHash, remoteHash] = await Promise.all([
    hashConflictContent(local),
    hashConflictContent(remote),
  ]);
  const result = decideAuditResult(local, remote);
  const conflictKey = await sha256Text(
    JSON.stringify({
      collection,
      recordId,
      localVersion: detected.localVersion,
      remoteVersion: detected.remoteVersion,
      localUpdatedAt: detected.localUpdatedAt,
      remoteUpdatedAt: detected.remoteUpdatedAt,
      localHash,
      remoteHash,
      result,
    }),
  );

  return {
    conflictId: randomConflictId(),
    conflictKey,
    collection,
    recordId,
    detectedAt,
    conflictType: detected.conflictType,
    local: {
      version: detected.localVersion,
      updatedAt: detected.localUpdatedAt,
      deviceId: detected.localDeviceId,
      operationId: detected.localOperationId,
      userId: readUserId(local),
      contentHash: localHash,
    },
    remote: {
      version: detected.remoteVersion,
      updatedAt: detected.remoteUpdatedAt,
      deviceId: detected.remoteDeviceId,
      operationId: detected.remoteOperationId,
      userId: readUserId(remote),
      contentHash: remoteHash,
    },
    result,
  };
}

type StoredConflictDetails = {
  kind?: string;
  conflictId?: string;
  conflictKey?: string;
};

async function findExistingConflictId(
  entry: RealConflictAuditEntry,
): Promise<string | null> {
  const db = getTafDatabase();
  if (!db) return null;
  const rows = await db.changeLog.where('documentId').equals(entry.recordId).toArray();
  for (const row of rows) {
    if (row.collection !== entry.collection || !row.details) continue;
    try {
      const details = JSON.parse(row.details) as StoredConflictDetails;
      if (
        details.kind === 'real_conflict_audit' &&
        details.conflictKey === entry.conflictKey &&
        details.conflictId
      ) {
        return details.conflictId;
      }
    } catch {
      // ChangeLog legado ou details não JSON.
    }
  }
  return null;
}

async function appendConflictChangeLog(entry: RealConflictAuditEntry): Promise<void> {
  await syncLogger.appendChangeLog({
    documentId: entry.recordId,
    collection: entry.collection,
    action: 'UPDATE',
    deviceId: entry.local.deviceId ?? (await getDeviceId()),
    userId: entry.local.userId ?? getCachedLoginUid(),
    previousVersion: entry.local.version ?? 0,
    newVersion: entry.remote.version ?? 0,
    timestamp: entry.detectedAt,
    resolution: `lww_${entry.result.winner}`,
    details: JSON.stringify({
      kind: 'real_conflict_audit',
      ...entry,
    }),
  });
}

async function persistConflictAudit(
  entry: RealConflictAuditEntry,
): Promise<AuditedRealConflict> {
  const existingId = await findExistingConflictId(entry);
  if (existingId) {
    return { ...entry, conflictId: existingId, isNewAudit: false };
  }

  await appendConflictChangeLog(entry);
  await syncLogger.warn('audit', `Conflito real detectado (${entry.conflictType})`, {
    conflictId: entry.conflictId,
    conflictKey: entry.conflictKey,
    collection: entry.collection,
    recordId: entry.recordId,
    detectedAt: entry.detectedAt,
    local: entry.local,
    remote: entry.remote,
    result: entry.result,
  });
  return { ...entry, isNewAudit: true };
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

  const candidates: Array<Promise<RealConflictAuditEntry>> = [];
  const now = Date.now();

  const scanCollection = <TRemote extends { id: string }>(
    collection: CollectionName,
    localRows: SyncRecord[],
    remoteRows: TRemote[],
    toRemote: (remote: TRemote, ownerUid: string) => SyncRecord,
  ) => {
    const remoteMap = new Map(remoteRows.map((row) => [row.id, toRemote(row, ownerUid)]));
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
      candidates.push(
        buildRealConflictAuditEntry({
          collection,
          recordId: local.id,
          detected,
          local,
          remote,
          detectedAt: now,
        }),
      );
    }
  };

  scanCollection('cadastros', localCad, remoteSnap.remoteCad, remoteToCadastro);
  scanCollection('sessoes', localSess, remoteSnap.remoteSess, remoteToSessao);
  scanCollection('aplicadores', localApp, remoteSnap.remoteApp, remoteToAplicador);

  const entries = await Promise.all(candidates);
  const found: AuditedRealConflict[] = [];
  for (const entry of entries) {
    found.push(await persistConflictAudit(entry));
  }

  const newCount = found.filter((entry) => entry.isNewAudit).length;
  if (newCount > 0) {
    await syncLogger.info(
      'audit',
      `${newCount} novo(s) conflito(s) real(is) auditado(s); LWW segue decidindo o vencedor.`,
      { ownerUid, newCount, totalDetected: found.length },
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
  const realConflicts: RealConflictAuditEntry[] = conflicts.map(
    ({ isNewAudit: _isNewAudit, ...entry }) => entry,
  );
  const enriched: SyncAuditEntry = {
    ...audit,
    realConflictCount: realConflicts.length,
    realConflicts,
  };

  const db = getTafDatabase();
  if (db && audit.id != null) {
    await db.syncAuditHistory.update(audit.id, {
      realConflictCount: enriched.realConflictCount,
      realConflicts: enriched.realConflicts,
    });
  }

  return enriched;
}
