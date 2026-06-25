import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { AplicadorRecord, CadastroRecord, SessaoRecord } from '../types';
import { getTafDatabase } from './tafDatabase';
import { getDeviceId } from '../deviceId';
import { bumpRecordMeta } from '../sync/ConflictResolver';
import { syncQueue } from '../sync/SyncQueue';
import { syncLogger } from '../sync/SyncLogger';

const ANONYMOUS_OWNER = '__local__';

export function resolveOwnerUid(uid: string | null | undefined): string {
  return uid?.trim() || ANONYMOUS_OWNER;
}

export async function toCadastroRecord(
  item: CadastroItemPersist,
  ownerUid: string,
  userId: string | null,
  operation: 'CREATE' | 'UPDATE',
): Promise<CadastroRecord> {
  const deviceId = await getDeviceId();
  const base: CadastroRecord = {
    ...item,
    ownerUid,
    createdAt: Date.now(),
    updatedAt: item.updatedAt ?? Date.now(),
    version: 1,
    deviceId,
    userId,
    syncStatus: 'pending',
    deleted: false,
    lastModifiedBy: deviceId,
  };
  return bumpRecordMeta(base, deviceId, userId, operation);
}

export async function toSessaoRecord(
  item: SessaoAplicacaoTaf,
  ownerUid: string,
  userId: string | null,
  operation: 'CREATE' | 'UPDATE',
): Promise<SessaoRecord> {
  const deviceId = await getDeviceId();
  const base: SessaoRecord = {
    ...item,
    ownerUid,
    createdAt: Date.parse(item.criadoEm) || Date.now(),
    updatedAt: item.updatedAt ?? Date.now(),
    version: 1,
    deviceId,
    userId,
    syncStatus: 'pending',
    deleted: false,
    lastModifiedBy: deviceId,
  };
  return bumpRecordMeta(base, deviceId, userId, operation);
}

export async function toAplicadorRecord(
  item: AplicadorItemPersist,
  ownerUid: string,
  userId: string | null,
  operation: 'CREATE' | 'UPDATE',
): Promise<AplicadorRecord> {
  const deviceId = await getDeviceId();
  const base: AplicadorRecord = {
    ...item,
    ownerUid,
    createdAt: Date.now(),
    updatedAt: item.updatedAt ?? Date.now(),
    version: 1,
    deviceId,
    userId,
    syncStatus: 'pending',
    deleted: false,
    lastModifiedBy: deviceId,
  };
  return bumpRecordMeta(base, deviceId, userId, operation);
}

export async function importAplicadorRecord(record: AplicadorRecord): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.aplicadores.put({ ...record, syncStatus: 'synced' });
}

export async function listCadastros(ownerUid: string, includeDeleted = false): Promise<CadastroRecord[]> {
  const db = getTafDatabase();
  if (!db) return [];
  const rows = await db.cadastros.where('ownerUid').equals(ownerUid).toArray();
  return includeDeleted ? rows : rows.filter((r) => !r.deleted);
}

export async function listAplicadores(ownerUid: string, includeDeleted = false): Promise<AplicadorRecord[]> {
  const db = getTafDatabase();
  if (!db) return [];
  const rows = await db.aplicadores.where('ownerUid').equals(ownerUid).toArray();
  return includeDeleted ? rows : rows.filter((r) => !r.deleted);
}

export async function listSessoes(ownerUid: string, includeDeleted = false): Promise<SessaoRecord[]> {
  const db = getTafDatabase();
  if (!db) return [];
  const rows = await db.sessoes.where('ownerUid').equals(ownerUid).toArray();
  const filtered = includeDeleted ? rows : rows.filter((r) => !r.deleted);
  return filtered.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function getCadastroById(ownerUid: string, id: string): Promise<CadastroRecord | null> {
  const db = getTafDatabase();
  if (!db) return null;
  const row = await db.cadastros.get(id);
  if (!row || row.ownerUid !== ownerUid || row.deleted) return null;
  return row;
}

export async function getSessaoById(ownerUid: string, id: string): Promise<SessaoRecord | null> {
  const db = getTafDatabase();
  if (!db) return null;
  const row = await db.sessoes.get(id);
  if (!row || row.ownerUid !== ownerUid || row.deleted) return null;
  return row;
}

export async function putCadastroRecord(record: CadastroRecord): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.cadastros.put(record);
}

export async function putSessaoRecord(record: SessaoRecord): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.sessoes.put(record);
}

export async function putAplicadorRecord(record: AplicadorRecord): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.aplicadores.put(record);
}

export async function importCadastroRecord(record: CadastroRecord): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.cadastros.put({ ...record, syncStatus: 'synced' });
}

export async function importSessaoRecord(record: SessaoRecord): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.sessoes.put({ ...record, syncStatus: 'synced' });
}

export async function getCadastroRaw(id: string): Promise<CadastroRecord | undefined> {
  const db = getTafDatabase();
  if (!db) return undefined;
  return db.cadastros.get(id);
}

export async function getAplicadorRaw(id: string): Promise<AplicadorRecord | undefined> {
  const db = getTafDatabase();
  if (!db) return undefined;
  return db.aplicadores.get(id);
}

export async function saveCadastro(
  item: CadastroItemPersist,
  ownerUid: string,
  userId: string | null,
): Promise<CadastroRecord> {
  const existing = await getCadastroRaw(item.id);
  const operation = existing && existing.ownerUid === ownerUid && !existing.deleted ? 'UPDATE' : 'CREATE';
  const record = await toCadastroRecord(
    existing && existing.ownerUid === ownerUid ? { ...existing, ...item } : item,
    ownerUid,
    userId,
    operation,
  );
  if (existing && existing.ownerUid === ownerUid) {
    record.createdAt = existing.createdAt;
  }
  await putCadastroRecord(record);
  await syncQueue.enqueue({
    operationType: operation,
    collection: 'cadastros',
    documentId: record.id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: record.id,
    collection: 'cadastros',
    action: operation,
    deviceId: record.deviceId,
    userId,
    previousVersion: existing?.version ?? 0,
    newVersion: record.version,
  });
  return record;
}

export async function saveCadastrosBatch(
  items: CadastroItemPersist[],
  ownerUid: string,
  userId: string | null,
): Promise<void> {
  if (items.length === 0) return;
  const db = getTafDatabase();
  if (!db) {
    for (const item of items) {
      await saveCadastro(item, ownerUid, userId);
    }
    return;
  }

  const records: CadastroRecord[] = [];

  for (const item of items) {
    const existing = await db.cadastros.get(item.id);
    const operation =
      existing && existing.ownerUid === ownerUid && !existing.deleted ? 'UPDATE' : 'CREATE';
    const record = await toCadastroRecord(
      existing && existing.ownerUid === ownerUid ? { ...existing, ...item } : item,
      ownerUid,
      userId,
      operation,
    );
    if (existing && existing.ownerUid === ownerUid) {
      record.createdAt = existing.createdAt;
    }
    records.push(record);
  }

  await db.cadastros.bulkPut(records);

  await syncQueue.enqueue({
    operationType: 'UPDATE',
    collection: 'cadastros',
    documentId: `__batch__:${Date.now()}`,
    payload: { kind: 'cadastrosBatch', items: records },
    ownerUid,
  });
}

export async function getSessaoRaw(id: string): Promise<SessaoRecord | undefined> {
  const db = getTafDatabase();
  if (!db) return undefined;
  return db.sessoes.get(id);
}

export async function softDeleteCadastro(
  id: string,
  ownerUid: string,
  userId: string | null,
): Promise<void> {
  const existing = await getCadastroRaw(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return;
  const record = bumpRecordMeta(existing, await getDeviceId(), userId, 'DELETE');
  await putCadastroRecord(record);
  await syncQueue.enqueue({
    operationType: 'DELETE',
    collection: 'cadastros',
    documentId: id,
    payload: { id, deleted: true },
    ownerUid,
  });
}

export async function saveAplicador(
  item: AplicadorItemPersist,
  ownerUid: string,
  userId: string | null,
): Promise<AplicadorRecord> {
  const existing = await getAplicadorRaw(item.id);
  const operation = existing && existing.ownerUid === ownerUid && !existing.deleted ? 'UPDATE' : 'CREATE';
  const record = await toAplicadorRecord(
    existing && existing.ownerUid === ownerUid ? { ...existing, ...item } : item,
    ownerUid,
    userId,
    operation,
  );
  if (existing && existing.ownerUid === ownerUid) {
    record.createdAt = existing.createdAt;
  }
  await putAplicadorRecord(record);
  await syncQueue.enqueue({
    operationType: operation,
    collection: 'aplicadores',
    documentId: record.id,
    payload: record,
    ownerUid,
  });
  return record;
}

export async function softDeleteAplicador(
  id: string,
  ownerUid: string,
  userId: string | null,
): Promise<void> {
  const existing = await getAplicadorRaw(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return;
  const record = bumpRecordMeta(existing, await getDeviceId(), userId, 'DELETE');
  await putAplicadorRecord(record);
  await syncQueue.enqueue({
    operationType: 'DELETE',
    collection: 'aplicadores',
    documentId: id,
    payload: { id, deleted: true },
    ownerUid,
  });
}

export async function saveSessao(
  item: SessaoAplicacaoTaf,
  ownerUid: string,
  userId: string | null,
): Promise<SessaoRecord> {
  const existing = await getSessaoRaw(item.id);
  const operation =
    existing && existing.ownerUid === ownerUid && !existing.deleted ? 'UPDATE' : 'CREATE';
  const record = await toSessaoRecord(
    existing && existing.ownerUid === ownerUid ? { ...existing, ...item } : item,
    ownerUid,
    userId,
    operation,
  );
  if (existing && existing.ownerUid === ownerUid) {
    record.createdAt = existing.createdAt;
  }
  await putSessaoRecord(record);
  await syncQueue.enqueue({
    operationType: operation,
    collection: 'sessoes',
    documentId: record.id,
    payload: record,
    ownerUid,
  });
  return record;
}

export async function softDeleteSessao(
  id: string,
  ownerUid: string,
  userId: string | null,
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const existing = await db.sessoes.get(id);
  if (!existing || existing.ownerUid !== ownerUid) return;
  const record = bumpRecordMeta(existing, await getDeviceId(), userId, 'DELETE');
  await putSessaoRecord(record);
  await syncQueue.enqueue({
    operationType: 'DELETE',
    collection: 'sessoes',
    documentId: id,
    payload: { id, deleted: true },
    ownerUid,
  });
}

export async function applyRemoteCadastro(
  remote: Partial<CadastroRecord> & { id: string },
  ownerUid: string,
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const local = await db.cadastros.get(remote.id);
  if (local && local.ownerUid === ownerUid) {
    const { resolveRecordConflict } = await import('../sync/ConflictResolver');
    const resolved = resolveRecordConflict(local, { ...local, ...remote, ownerUid } as CadastroRecord);
    if (resolved.hadConflict) {
      await syncLogger.warn('conflict', resolved.reason, { id: remote.id, collection: 'cadastros' });
    }
    await db.cadastros.put({ ...resolved.record, syncStatus: 'synced' });
    return;
  }
  await db.cadastros.put({
    ...(remote as CadastroRecord),
    ownerUid,
    syncStatus: 'synced',
    deleted: remote.deleted ?? false,
  });
}

export async function applyRemoteSessao(
  remote: Partial<SessaoRecord> & { id: string },
  ownerUid: string,
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const local = await db.sessoes.get(remote.id);
  if (local && local.ownerUid === ownerUid) {
    const { resolveRecordConflict } = await import('../sync/ConflictResolver');
    const resolved = resolveRecordConflict(local, { ...local, ...remote, ownerUid } as SessaoRecord);
    if (resolved.hadConflict) {
      await syncLogger.warn('conflict', resolved.reason, { id: remote.id, collection: 'sessoes' });
    }
    await db.sessoes.put({ ...resolved.record, syncStatus: 'synced' });
    return;
  }
  await db.sessoes.put({
    ...(remote as SessaoRecord),
    ownerUid,
    syncStatus: 'synced',
    deleted: remote.deleted ?? false,
  });
}

export async function applyRemoteAplicador(
  remote: Partial<AplicadorRecord> & { id: string },
  ownerUid: string,
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const local = await db.aplicadores.get(remote.id);
  if (local && local.ownerUid === ownerUid) {
    const { resolveRecordConflict } = await import('../sync/ConflictResolver');
    const resolved = resolveRecordConflict(local, { ...local, ...remote, ownerUid } as AplicadorRecord);
    if (resolved.hadConflict) {
      await syncLogger.warn('conflict', resolved.reason, { id: remote.id, collection: 'aplicadores' });
    }
    await db.aplicadores.put({ ...resolved.record, syncStatus: 'synced' });
    return;
  }
  await db.aplicadores.put({
    ...(remote as AplicadorRecord),
    ownerUid,
    syncStatus: 'synced',
    deleted: remote.deleted ?? false,
  });
}

export async function wipeOwnerData(ownerUid: string): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.cadastros.where('ownerUid').equals(ownerUid).delete();
  await db.aplicadores.where('ownerUid').equals(ownerUid).delete();
  await db.sessoes.where('ownerUid').equals(ownerUid).delete();
  await db.syncQueue.where('ownerUid').equals(ownerUid).delete();
}

export { ANONYMOUS_OWNER };
