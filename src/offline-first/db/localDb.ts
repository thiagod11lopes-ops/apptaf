import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { AplicadorRecord, CadastroRecord, SessaoRecord } from '../types';
import { getTafDatabase } from './tafDatabase';
import { getDeviceId } from '../deviceId';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { isAuthorizedMemberSession } from '../../utils/aplicadorSyncPolicy';
import { bumpRecordMeta, markRecordSynced, ensureRecordMeta } from '../sync/recordMeta';
import { decideLastWriteWins } from '../sync/lastWriteWins';
import { syncQueue } from '../sync/SyncQueue';
import { syncLogger } from '../sync/SyncLogger';
import { syncStatusForOperation } from '../sync/syncStatus';
import { normalizeSessaoShape } from '../../utils/sessaoLight';
import { nipChaveCadastro } from '../../utils/nipFormat';
import { dedupeCadastrosByNipNewest } from '../../services/offline/conflictMerge';
import { readUpdatedAt } from '../sync/recordMeta';
import { isModoDemonstracaoAtivo } from './appMeta';

const ANONYMOUS_OWNER = '__local__';

async function enqueueIfAllowed(entry: Parameters<typeof syncQueue.enqueue>[0]): Promise<void> {
  if (isModoDemonstracaoAtivo()) return;
  await syncQueue.enqueue(entry);
}

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
    syncVersion: 1,
    deviceId,
    userId,
    syncStatus: syncStatusForOperation(operation),
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
    syncVersion: 1,
    deviceId,
    userId,
    syncStatus: syncStatusForOperation(operation),
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
    syncVersion: 1,
    deviceId,
    userId,
    syncStatus: syncStatusForOperation(operation),
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

function mergeRecordsById<T extends { id: string; updatedAt: number; ownerUid: string }>(
  targetOwnerUid: string,
  batches: T[][],
): T[] {
  const byId = new Map<string, T>();
  for (const batch of batches) {
    for (const row of batch) {
      const existing = byId.get(row.id);
      if (!existing || row.updatedAt >= existing.updatedAt) {
        byId.set(row.id, { ...row, ownerUid: targetOwnerUid });
      }
    }
  }
  return [...byId.values()];
}

function uniqueOwnerSources(...uids: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const uid of uids) {
    const v = uid?.trim();
    if (!v || out.includes(v)) continue;
    out.push(v);
  }
  return out;
}

function resolveDisplayOwnerUid(ownerUid: string | null): string {
  if (ownerUid?.trim()) return ownerUid.trim();
  return ANONYMOUS_OWNER;
}

/** Lista cadastros para exibição — inclui owner persistido e __local__ (modo offline). */
export async function listCadastrosForDisplay(ownerUid: string | null): Promise<CadastroRecord[]> {
  const { readAppMetaCache } = await import('./appMeta');
  const primary = resolveDisplayOwnerUid(ownerUid);
  const persisted = readAppMetaCache('session:dataOwnerUid');
  const sources = uniqueOwnerSources(primary, ANONYMOUS_OWNER, persisted);
  const batches = await Promise.all(sources.map((uid) => listCadastros(uid)));
  const mergeTarget = primary !== ANONYMOUS_OWNER ? primary : (persisted ?? primary);
  const merged = mergeRecordsById(mergeTarget, batches);
  return dedupeCadastrosByNipNewest(merged) as CadastroRecord[];
}

/** Lista sessões para exibição — inclui owner persistido e __local__ (modo offline). */
export async function listSessoesForDisplay(ownerUid: string | null): Promise<SessaoRecord[]> {
  const { readAppMetaCache } = await import('./appMeta');
  const primary = resolveDisplayOwnerUid(ownerUid);
  const persisted = readAppMetaCache('session:dataOwnerUid');
  const sources = uniqueOwnerSources(primary, ANONYMOUS_OWNER, persisted);
  const batches = await Promise.all(sources.map((uid) => listSessoes(uid)));
  const mergeTarget = primary !== ANONYMOUS_OWNER ? primary : (persisted ?? primary);
  return mergeRecordsById(mergeTarget, batches).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Lista aplicadores para exibição — inclui owner persistido e __local__ (modo offline). */
export async function listAplicadoresForDisplay(ownerUid: string | null): Promise<AplicadorRecord[]> {
  const { readAppMetaCache } = await import('./appMeta');
  const primary = resolveDisplayOwnerUid(ownerUid);
  const persisted = readAppMetaCache('session:dataOwnerUid');
  const sources = uniqueOwnerSources(primary, ANONYMOUS_OWNER, persisted);
  const batches = await Promise.all(sources.map((uid) => listAplicadores(uid)));
  const mergeTarget = primary !== ANONYMOUS_OWNER ? primary : (persisted ?? primary);
  return mergeRecordsById(mergeTarget, batches);
}

/** Lista registros locais para sync — inclui __local__ e UID de login antes da migração. */
export async function listCadastrosForSync(
  ownerUid: string,
  includeDeleted = false,
): Promise<CadastroRecord[]> {
  const loginUid = getCachedLoginUid();
  const sources = [ownerUid, ANONYMOUS_OWNER];
  if (loginUid && loginUid !== ownerUid && !sources.includes(loginUid)) {
    sources.push(loginUid);
  }
  const batches = await Promise.all(sources.map((uid) => listCadastros(uid, includeDeleted)));
  return mergeRecordsById(ownerUid, batches);
}

export async function listSessoesForSync(
  ownerUid: string,
  includeDeleted = false,
): Promise<SessaoRecord[]> {
  const loginUid = getCachedLoginUid();
  const sources = [ownerUid, ANONYMOUS_OWNER];
  if (loginUid && loginUid !== ownerUid && !sources.includes(loginUid)) {
    sources.push(loginUid);
  }
  const batches = await Promise.all(sources.map((uid) => listSessoes(uid, includeDeleted)));
  const merged = mergeRecordsById(ownerUid, batches);
  return merged.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function listAplicadoresForSync(
  ownerUid: string,
  includeDeleted = false,
): Promise<AplicadorRecord[]> {
  const loginUid = getCachedLoginUid();
  const sources = [ownerUid, ANONYMOUS_OWNER];
  if (loginUid && loginUid !== ownerUid && !sources.includes(loginUid)) {
    sources.push(loginUid);
  }
  const batches = await Promise.all(sources.map((uid) => listAplicadores(uid, includeDeleted)));
  return mergeRecordsById(ownerUid, batches);
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

export async function findCadastroByNipDigits(
  ownerUid: string,
  nip: string,
  excludeId?: string,
): Promise<CadastroRecord | undefined> {
  const key = nipChaveCadastro(nip);
  if (!key) return undefined;
  const loginUid = getCachedLoginUid();
  const sources = uniqueOwnerSources(ownerUid, ANONYMOUS_OWNER, loginUid);
  for (const uid of sources) {
    const rows = await listCadastros(uid);
    const found = rows.find((r) => r.id !== excludeId && nipChaveCadastro(r.nip) === key);
    if (found) return found;
  }
  return undefined;
}

/** Remove cadastros duplicados no IndexedDB (mesmo NIP, IDs diferentes). */
export async function compactDuplicateCadastrosByNip(ownerUid: string): Promise<number> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return 0;

  const loginUid = getCachedLoginUid();
  const sources = uniqueOwnerSources(ownerUid, ANONYMOUS_OWNER, loginUid);
  const allRows: CadastroRecord[] = [];
  for (const uid of sources) {
    allRows.push(...(await listCadastros(uid, true)));
  }

  const porNip = new Map<string, CadastroRecord>();
  for (const row of allRows) {
    const key = nipChaveCadastro(row.nip);
    if (!key) continue;
    const atual = porNip.get(key);
    if (!atual || readUpdatedAt(row) >= readUpdatedAt(atual)) {
      porNip.set(key, row);
    }
  }

  const keepIds = new Set([...porNip.values()].map((r) => r.id));
  const toDelete = allRows.filter((r) => {
    const key = nipChaveCadastro(r.nip);
    return key && !keepIds.has(r.id);
  });
  if (toDelete.length === 0) return 0;

  await db.cadastros.bulkDelete(toDelete.map((r) => r.id));
  for (const row of toDelete) {
    await syncQueue.clearPendingForDocument(row.ownerUid, 'cadastros', row.id);
  }
  await syncLogger.info(
    'local-db',
    `Removidos ${toDelete.length} cadastro(s) duplicado(s) por NIP`,
    { ownerUid },
  );
  return toDelete.length;
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
  await db.sessoes.put({ ...record, ...normalizeSessaoShape(record) });
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
  await db.sessoes.put({ ...record, ...normalizeSessaoShape(record), syncStatus: 'synced' });
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
  let payload = item;
  let existing = await getCadastroRaw(payload.id);
  if (existing?.deleted) existing = undefined;

  const byNip = await findCadastroByNipDigits(ownerUid, payload.nip, payload.id);
  if (byNip && !byNip.deleted && (!existing || byNip.id !== existing.id)) {
    existing = byNip;
    payload = { ...payload, id: byNip.id };
  }

  const operation = existing ? 'UPDATE' : 'CREATE';
  const record = await toCadastroRecord(
    existing ? { ...existing, ...payload } : payload,
    ownerUid,
    userId,
    operation,
  );
  if (existing) {
    record.createdAt = existing.createdAt;
  }
  await putCadastroRecord(record);
  await enqueueIfAllowed({
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
  const loginUid = getCachedLoginUid();
  const sources = uniqueOwnerSources(ownerUid, ANONYMOUS_OWNER, loginUid);
  const existingRows: CadastroRecord[] = [];
  for (const uid of sources) {
    existingRows.push(...(await listCadastros(uid)));
  }
  const porNip = new Map<string, CadastroRecord>();
  for (const row of existingRows) {
    const key = nipChaveCadastro(row.nip);
    if (!key) continue;
    const atual = porNip.get(key);
    if (!atual || readUpdatedAt(row) >= readUpdatedAt(atual)) {
      porNip.set(key, row);
    }
  }

  for (const item of items) {
    const nipKey = nipChaveCadastro(item.nip);
    const existingByNip = nipKey ? porNip.get(nipKey) : undefined;
    const existingById = await db.cadastros.get(existingByNip?.id ?? item.id);
    const existing =
      existingById && existingById.ownerUid === ownerUid && !existingById.deleted
        ? existingById
        : existingByNip && existingByNip.ownerUid === ownerUid && !existingByNip.deleted
          ? existingByNip
          : undefined;
    const payload = existing ? { ...item, id: existing.id } : item;
    const operation = existing ? 'UPDATE' : 'CREATE';
    const record = await toCadastroRecord(
      existing ? { ...existing, ...payload } : payload,
      ownerUid,
      userId,
      operation,
    );
    if (existing) {
      record.createdAt = existing.createdAt;
    }
    records.push(record);
    if (nipKey) {
      porNip.set(nipKey, record);
    }
  }

  await db.cadastros.bulkPut(records);

  await enqueueIfAllowed({
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
  await enqueueIfAllowed({
    operationType: 'DELETE',
    collection: 'cadastros',
    documentId: id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: id,
    collection: 'cadastros',
    action: 'DELETE',
    deviceId: record.deviceId,
    userId,
    previousVersion: existing.version,
    newVersion: record.version,
  });
}

export async function saveAplicador(
  item: AplicadorItemPersist,
  ownerUid: string,
  userId: string | null,
): Promise<AplicadorRecord> {
  if (isAuthorizedMemberSession()) {
    throw new Error('Cadastro de aplicador disponível apenas para o e-mail chefe.');
  }
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
  await enqueueIfAllowed({
    operationType: operation,
    collection: 'aplicadores',
    documentId: record.id,
    payload: record,
    ownerUid,
  });
  return record;
}

/**
 * Remove a rúbrica salva do aplicador (apenas e-mail chefe).
 * Na próxima assinatura o aplicador desenha novamente.
 */
export async function clearAplicadorRubricaSvg(
  id: string,
  ownerUid: string,
  userId: string | null,
): Promise<AplicadorRecord | null> {
  if (isAuthorizedMemberSession()) {
    throw new Error('Exclusão de rúbrica disponível apenas para o e-mail chefe.');
  }

  const existing = await getAplicadorRaw(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return null;
  if (!existing.rubricaSvg?.trim()) return existing;

  const base: AplicadorRecord = { ...existing };
  delete base.rubricaSvg;
  const record = bumpRecordMeta(base, await getDeviceId(), userId, 'UPDATE');
  await putAplicadorRecord(record);
  await enqueueIfAllowed({
    operationType: 'UPDATE',
    collection: 'aplicadores',
    documentId: id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: id,
    collection: 'aplicadores',
    action: 'UPDATE',
    deviceId: record.deviceId,
    userId,
    previousVersion: existing.version,
    newVersion: record.version,
  });
  return record;
}

/**
 * Substitui a rúbrica salva do aplicador (sempre sobrescreve).
 * Permitido também para membros autorizados — identidade permanece inalterada.
 */
export async function replaceAplicadorRubricaSvg(
  id: string,
  rubricaSvg: string,
  ownerUid: string,
  userId: string | null,
): Promise<AplicadorRecord | null> {
  const svg = rubricaSvg.trim();
  if (!svg) return null;

  const existing = await getAplicadorRaw(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return null;

  const base: AplicadorRecord = {
    ...existing,
    rubricaSvg: svg,
  };
  const record = bumpRecordMeta(base, await getDeviceId(), userId, 'UPDATE');
  await putAplicadorRecord(record);
  await enqueueIfAllowed({
    operationType: 'UPDATE',
    collection: 'aplicadores',
    documentId: id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: id,
    collection: 'aplicadores',
    action: 'UPDATE',
    deviceId: record.deviceId,
    userId,
    previousVersion: existing.version,
    newVersion: record.version,
  });
  return record;
}

/**
 * Grava a rúbrica do aplicador na primeira assinatura (não sobrescreve).
 * Permitido também para membros autorizados — identidade permanece inalterada.
 */
export async function updateAplicadorRubricaSvgIfEmpty(
  id: string,
  rubricaSvg: string,
  ownerUid: string,
  userId: string | null,
): Promise<AplicadorRecord | null> {
  const svg = rubricaSvg.trim();
  if (!svg) return null;

  const existing = await getAplicadorRaw(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return null;
  if (existing.rubricaSvg?.trim()) return null;

  const base: AplicadorRecord = {
    ...existing,
    rubricaSvg: svg,
  };
  const record = bumpRecordMeta(base, await getDeviceId(), userId, 'UPDATE');
  await putAplicadorRecord(record);
  await enqueueIfAllowed({
    operationType: 'UPDATE',
    collection: 'aplicadores',
    documentId: id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: id,
    collection: 'aplicadores',
    action: 'UPDATE',
    deviceId: record.deviceId,
    userId,
    previousVersion: existing.version,
    newVersion: record.version,
  });
  return record;
}

/**
 * Atualiza somente a senha (senhaHash) de um aplicador existente.
 * Permitido também para membros autorizados — identidade (nip/nome/categoria)
 * permanece inalterada, o que é garantido pelas regras do Firestore no upload.
 */
export async function updateAplicadorSenhaHash(
  id: string,
  senhaHash: string,
  ownerUid: string,
  userId: string | null,
  senhaPlano?: string,
): Promise<AplicadorRecord | null> {
  const existing = await getAplicadorRaw(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return null;

  const base: AplicadorRecord = {
    ...existing,
    senhaHash,
    ...(senhaPlano !== undefined ? { senha: senhaPlano } : {}),
  };
  const record = bumpRecordMeta(base, await getDeviceId(), userId, 'UPDATE');
  await putAplicadorRecord(record);
  await enqueueIfAllowed({
    operationType: 'UPDATE',
    collection: 'aplicadores',
    documentId: id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: id,
    collection: 'aplicadores',
    action: 'UPDATE',
    deviceId: record.deviceId,
    userId,
    previousVersion: existing.version,
    newVersion: record.version,
  });
  return record;
}

export async function softDeleteAplicador(
  id: string,
  ownerUid: string,
  userId: string | null,
): Promise<void> {
  if (isAuthorizedMemberSession()) {
    throw new Error('Cadastro de aplicador disponível apenas para o e-mail chefe.');
  }
  const existing = await getAplicadorRaw(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return;
  const record = bumpRecordMeta(existing, await getDeviceId(), userId, 'DELETE');
  await putAplicadorRecord(record);
  await enqueueIfAllowed({
    operationType: 'DELETE',
    collection: 'aplicadores',
    documentId: id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: id,
    collection: 'aplicadores',
    action: 'DELETE',
    deviceId: record.deviceId,
    userId,
    previousVersion: existing.version,
    newVersion: record.version,
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
  await enqueueIfAllowed({
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
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return;
  const record = bumpRecordMeta(existing, await getDeviceId(), userId, 'DELETE');
  await putSessaoRecord(record);
  await enqueueIfAllowed({
    operationType: 'DELETE',
    collection: 'sessoes',
    documentId: id,
    payload: record,
    ownerUid,
  });
  await syncLogger.appendChangeLog({
    documentId: id,
    collection: 'sessoes',
    action: 'DELETE',
    deviceId: record.deviceId,
    userId,
    previousVersion: existing.version,
    newVersion: record.version,
  });
}

export async function applyRemoteCadastro(
  remote: Partial<CadastroRecord> & { id: string },
  ownerUid: string,
): Promise<'upload' | 'download' | 'skip'> {
  const db = getTafDatabase();
  if (!db) return 'skip';
  const local = await db.cadastros.get(remote.id);
  const remoteRecord = ensureRecordMeta({ ...remote, ownerUid } as CadastroRecord, ownerUid);

  if (local && local.ownerUid === ownerUid) {
    const decision = decideLastWriteWins(local, remoteRecord);
    if (decision.action === 'skip') return 'skip';
    if (decision.action === 'upload') return 'upload';
    await db.cadastros.put(markRecordSynced({ ...local, ...remoteRecord, ownerUid }, getCachedLoginUid()));
    return 'download';
  }

  await db.cadastros.put(markRecordSynced(remoteRecord, null));
  return 'download';
}

export async function applyRemoteSessao(
  remote: Partial<SessaoRecord> & { id: string },
  ownerUid: string,
): Promise<'upload' | 'download' | 'skip'> {
  const db = getTafDatabase();
  if (!db) return 'skip';
  const local = await db.sessoes.get(remote.id);
  const remoteRecord = ensureRecordMeta({ ...remote, ownerUid } as SessaoRecord, ownerUid);

  if (local && local.ownerUid === ownerUid) {
    const decision = decideLastWriteWins(local, remoteRecord);
    if (decision.action === 'skip') return 'skip';
    if (decision.action === 'upload') return 'upload';
    await db.sessoes.put(markRecordSynced({ ...local, ...remoteRecord, ownerUid }, null));
    return 'download';
  }

  await db.sessoes.put(markRecordSynced(remoteRecord, null));
  return 'download';
}

export async function applyRemoteAplicador(
  remote: Partial<AplicadorRecord> & { id: string },
  ownerUid: string,
): Promise<'upload' | 'download' | 'skip'> {
  const db = getTafDatabase();
  if (!db) return 'skip';
  const local = await db.aplicadores.get(remote.id);
  const remoteRecord = ensureRecordMeta({ ...remote, ownerUid } as AplicadorRecord, ownerUid);

  if (local && local.ownerUid === ownerUid) {
    const decision = decideLastWriteWins(local, remoteRecord);
    if (decision.action === 'skip') return 'skip';
    if (decision.action === 'upload') return 'upload';
    await db.aplicadores.put(markRecordSynced({ ...local, ...remoteRecord, ownerUid }, null));
    return 'download';
  }

  await db.aplicadores.put(markRecordSynced(remoteRecord, null));
  return 'download';
}

export type ApplyCsvLwwResult = 'created' | 'applied' | 'kept_local';

/**
 * Importação CSV no estilo do sync por disquete (last-write-wins por updatedAt).
 * Se o CSV não trouxer updatedAt, trata como 0 — o local mais recente prevalece.
 */
export async function applyCsvCadastroLww(
  remote: CadastroItemPersist,
  ownerUid: string,
): Promise<ApplyCsvLwwResult> {
  const db = getTafDatabase();
  if (!db) throw new Error('Armazenamento local indisponível.');

  let payload = { ...remote };
  const byNip = await findCadastroByNipDigits(ownerUid, payload.nip, payload.id);
  if (byNip && !byNip.deleted) {
    payload = { ...payload, id: byNip.id };
  }

  const local = await db.cadastros.get(payload.id);
  const remoteAt =
    typeof payload.updatedAt === 'number' && payload.updatedAt > 0 ? payload.updatedAt : 0;

  if (!local || local.deleted || local.ownerUid !== ownerUid) {
    const deviceId = await getDeviceId();
    const userId = getCachedLoginUid();
    const base = ensureRecordMeta(
      { ...payload, ownerUid, updatedAt: remoteAt || Date.now() } as CadastroRecord,
      ownerUid,
    );
    await db.cadastros.put(bumpRecordMeta(base, deviceId, userId, 'CREATE'));
    return 'created';
  }

  const remoteForLww = { ...local, ...payload, ownerUid, updatedAt: remoteAt };
  const decision = decideLastWriteWins(local, remoteForLww);
  if (decision.action !== 'download') return 'kept_local';

  const deviceId = await getDeviceId();
  const userId = getCachedLoginUid();
  await db.cadastros.put(
    bumpRecordMeta(
      {
        ...local,
        ...payload,
        ownerUid,
        updatedAt: remoteAt > 0 ? remoteAt : local.updatedAt,
        createdAt: local.createdAt,
      } as CadastroRecord,
      deviceId,
      userId,
      'UPDATE',
    ),
  );
  return 'applied';
}

export async function applyCsvSessaoLww(
  remote: SessaoAplicacaoTaf,
  ownerUid: string,
): Promise<ApplyCsvLwwResult> {
  const db = getTafDatabase();
  if (!db) throw new Error('Armazenamento local indisponível.');

  const normalized = normalizeSessaoShape(remote);
  const local = await db.sessoes.get(normalized.id);
  const remoteAt =
    typeof normalized.updatedAt === 'number' && normalized.updatedAt > 0
      ? normalized.updatedAt
      : readUpdatedAt({ criadoEm: normalized.criadoEm, updatedAt: normalized.updatedAt });

  if (!local || local.deleted || local.ownerUid !== ownerUid) {
    const deviceId = await getDeviceId();
    const userId = getCachedLoginUid();
    const base = ensureRecordMeta(
      {
        ...normalized,
        ownerUid,
        updatedAt: remoteAt || Date.now(),
      } as SessaoRecord,
      ownerUid,
    );
    await db.sessoes.put(bumpRecordMeta(base, deviceId, userId, 'CREATE'));
    return 'created';
  }

  const remoteForLww = { ...local, ...normalized, ownerUid, updatedAt: remoteAt };
  const decision = decideLastWriteWins(local, remoteForLww);
  if (decision.action !== 'download') return 'kept_local';

  const deviceId = await getDeviceId();
  const userId = getCachedLoginUid();
  await db.sessoes.put(
    bumpRecordMeta(
      {
        ...local,
        ...normalized,
        ownerUid,
        updatedAt: remoteAt > 0 ? remoteAt : local.updatedAt,
        createdAt: local.createdAt,
      } as SessaoRecord,
      deviceId,
      userId,
      'UPDATE',
    ),
  );
  return 'applied';
}

export async function applyCsvAplicadorLww(
  remote: AplicadorItemPersist,
  ownerUid: string,
): Promise<ApplyCsvLwwResult> {
  const db = getTafDatabase();
  if (!db) throw new Error('Armazenamento local indisponível.');

  const local = await db.aplicadores.get(remote.id);
  const remoteAt =
    typeof remote.updatedAt === 'number' && remote.updatedAt > 0 ? remote.updatedAt : 0;

  if (!local || local.deleted || local.ownerUid !== ownerUid) {
    const deviceId = await getDeviceId();
    const userId = getCachedLoginUid();
    const base = ensureRecordMeta(
      { ...remote, ownerUid, updatedAt: remoteAt || Date.now() } as AplicadorRecord,
      ownerUid,
    );
    await db.aplicadores.put(bumpRecordMeta(base, deviceId, userId, 'CREATE'));
    return 'created';
  }

  const remoteForLww = { ...local, ...remote, ownerUid, updatedAt: remoteAt };
  const decision = decideLastWriteWins(local, remoteForLww);
  if (decision.action !== 'download') return 'kept_local';

  const deviceId = await getDeviceId();
  const userId = getCachedLoginUid();
  await db.aplicadores.put(
    bumpRecordMeta(
      {
        ...local,
        ...remote,
        ownerUid,
        updatedAt: remoteAt > 0 ? remoteAt : local.updatedAt,
        createdAt: local.createdAt,
      } as AplicadorRecord,
      deviceId,
      userId,
      'UPDATE',
    ),
  );
  return 'applied';
}

export async function wipeOwnerData(ownerUid: string): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.cadastros.where('ownerUid').equals(ownerUid).delete();
  await db.aplicadores.where('ownerUid').equals(ownerUid).delete();
  await db.sessoes.where('ownerUid').equals(ownerUid).delete();
  await db.preCadastros.where('ownerUid').equals(ownerUid).delete();
  await db.syncQueue.where('ownerUid').equals(ownerUid).delete();
}

/** Substitui dados do owner por dataset de demonstração — sem fila de sync. */
export async function importDemonstracaoDataset(
  ownerUid: string,
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
  aplicadores: AplicadorItemPersist[] = [],
): Promise<void> {
  const db = getTafDatabase();
  if (!db) throw new Error('Armazenamento local indisponível para modo demonstração.');

  const deviceId = await getDeviceId();
  const userId = getCachedLoginUid();
  const now = Date.now();

  const cadRecords: CadastroRecord[] = cadastros.map((item) =>
    markRecordSynced(
      bumpRecordMeta(
        {
          ...item,
          ownerUid,
          createdAt: now,
          updatedAt: item.updatedAt ?? now,
          version: 1,
          syncVersion: 1,
          deviceId,
          userId,
          syncStatus: 'synced',
          deleted: false,
          lastModifiedBy: deviceId,
        } as CadastroRecord,
        deviceId,
        userId,
        'CREATE',
      ),
      userId,
    ),
  );

  const sessRecords: SessaoRecord[] = sessoes.map((item) =>
    markRecordSynced(
      bumpRecordMeta(
        {
          ...normalizeSessaoShape(item),
          ownerUid,
          createdAt: Date.parse(item.criadoEm) || now,
          updatedAt: item.updatedAt ?? now,
          version: 1,
          syncVersion: 1,
          deviceId,
          userId,
          syncStatus: 'synced',
          deleted: false,
          lastModifiedBy: deviceId,
        } as SessaoRecord,
        deviceId,
        userId,
        'CREATE',
      ),
      userId,
    ),
  );

  const CHUNK = 400;
  for (let i = 0; i < cadRecords.length; i += CHUNK) {
    await db.cadastros.bulkPut(cadRecords.slice(i, i + CHUNK));
  }
  for (let i = 0; i < sessRecords.length; i += CHUNK) {
    await db.sessoes.bulkPut(sessRecords.slice(i, i + CHUNK));
  }

  if (aplicadores.length > 0) {
    const appRecords: AplicadorRecord[] = await Promise.all(
      aplicadores.map(async (item) =>
        markRecordSynced(
          bumpRecordMeta(
            {
              ...item,
              ownerUid,
              createdAt: now,
              updatedAt: item.updatedAt ?? now,
              version: 1,
              syncVersion: 1,
              deviceId,
              userId,
              syncStatus: 'synced',
              deleted: false,
              lastModifiedBy: deviceId,
            } as AplicadorRecord,
            deviceId,
            userId,
            'CREATE',
          ),
          userId,
        ),
      ),
    );
    await db.aplicadores.bulkPut(appRecords);
  }
}

export { ANONYMOUS_OWNER };
