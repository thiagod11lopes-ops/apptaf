import type { CadastroRecord, SessaoRecord, AplicadorRecord, ConflictResolution } from '../types';

type SyncRecord = CadastroRecord | SessaoRecord | AplicadorRecord;

function readVersion(record: Partial<SyncRecord> | null | undefined): number {
  return typeof record?.version === 'number' && record.version > 0 ? record.version : 1;
}

function readUpdatedAt(record: Partial<SyncRecord> | null | undefined): number {
  if (typeof record?.updatedAt === 'number' && record.updatedAt > 0) return record.updatedAt;
  if ('criadoEm' in (record ?? {}) && record?.criadoEm) {
    const parsed = Date.parse(String(record.criadoEm));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function mergePayload<T extends Record<string, unknown>>(local: T, remote: T): T {
  const merged = { ...remote, ...local } as T;
  for (const key of Object.keys(remote)) {
    const rv = remote[key];
    const lv = local[key];
    if (rv != null && rv !== '' && (lv == null || lv === '')) {
      (merged as Record<string, unknown>)[key] = rv;
    }
  }
  return merged;
}

export function resolveRecordConflict<T extends SyncRecord>(
  local: T,
  remote: T,
): ConflictResolution & { record: T } {
  if (local.syncStatus === 'pending' && local.deleted !== true) {
    return {
      winner: 'local',
      record: local,
      hadConflict: true,
      reason: 'Alteração local pendente de envio — mantida offline',
    };
  }

  const localDeleted = local.deleted === true;
  const remoteDeleted = remote.deleted === true;

  if (localDeleted && remoteDeleted) {
    const newer = readUpdatedAt(local) >= readUpdatedAt(remote) ? local : remote;
    return {
      winner: readUpdatedAt(local) >= readUpdatedAt(remote) ? 'local' : 'remote',
      record: { ...newer, deleted: true } as T,
      hadConflict: false,
      reason: 'Ambos excluídos — mantém exclusão mais recente',
    };
  }

  if (localDeleted !== remoteDeleted) {
    const deletedSide = localDeleted ? local : remote;
    const activeSide = localDeleted ? remote : local;
    if (readUpdatedAt(deletedSide) > readUpdatedAt(activeSide)) {
      return {
        winner: localDeleted ? 'local' : 'remote',
        record: { ...deletedSide, deleted: true } as T,
        hadConflict: true,
        reason: 'Exclusão mais recente prevalece',
      };
    }
    return {
      winner: localDeleted ? 'remote' : 'local',
      record: { ...activeSide, deleted: false } as T,
      hadConflict: true,
      reason: 'Alteração ativa mais recente cancelou exclusão',
    };
  }

  const localVersion = readVersion(local);
  const remoteVersion = readVersion(remote);

  if (localVersion > remoteVersion) {
    return { winner: 'local', record: local, hadConflict: false, reason: 'version local maior' };
  }
  if (remoteVersion > localVersion) {
    return { winner: 'remote', record: remote, hadConflict: false, reason: 'version remota maior' };
  }

  const localTs = readUpdatedAt(local);
  const remoteTs = readUpdatedAt(remote);

  if (localTs > remoteTs) {
    return { winner: 'local', record: local, hadConflict: localTs !== remoteTs, reason: 'updatedAt local maior' };
  }
  if (remoteTs > localTs) {
    return { winner: 'remote', record: remote, hadConflict: localTs !== remoteTs, reason: 'updatedAt remota maior' };
  }

  const merged = mergePayload(local, remote) as T;
  return {
    winner: 'merged',
    record: {
      ...merged,
      version: Math.max(localVersion, remoteVersion) + 1,
      updatedAt: Math.max(localTs, remoteTs, Date.now()),
      syncStatus: 'synced',
    },
    hadConflict: JSON.stringify(local) !== JSON.stringify(remote),
    reason: 'Mesma versão/timestamp — merge inteligente',
  };
}

export function bumpRecordMeta<T extends SyncRecord>(
  record: T,
  deviceId: string,
  userId: string | null,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
): T {
  const now = Date.now();
  const version = operation === 'CREATE' ? 1 : readVersion(record) + 1;
  if (operation === 'DELETE') {
    return {
      ...record,
      deleted: true,
      deletedAt: now,
      deletedBy: deviceId,
      updatedAt: now,
      version,
      deviceId,
      userId,
      syncStatus: 'pending',
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
    version,
    deviceId,
    userId,
    syncStatus: 'pending',
    lastModifiedBy: deviceId,
  };
}
