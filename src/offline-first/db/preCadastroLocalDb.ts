import type { PreCadastroRecord } from '../types';
import type { PreCadastroTaf } from '../../services/preCadastroTafStorage';
import { getTafDatabase } from './tafDatabase';
import { getDeviceId } from '../deviceId';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { ensureRecordMeta } from '../sync/recordMeta';
import { syncStatusForOperation } from '../sync/syncStatus';
import {
  hydrateAppMetaFromIndexedDb,
  preCadastroMetaKey,
  readAppMeta,
  removeAppMeta,
} from './appMeta';

const ANONYMOUS_OWNER = '__local__';

function mergePreCadastrosById(
  targetOwnerUid: string,
  batches: PreCadastroRecord[][],
): PreCadastroRecord[] {
  const map = new Map<string, PreCadastroRecord>();
  for (const batch of batches) {
    for (const row of batch) {
      const existing = map.get(row.id);
      if (!existing || row.updatedAt >= existing.updatedAt) {
        map.set(row.id, { ...row, ownerUid: targetOwnerUid });
      }
    }
  }
  return [...map.values()];
}

export async function toPreCadastroRecord(
  item: PreCadastroTaf,
  ownerUid: string,
  userId: string | null,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
): Promise<PreCadastroRecord> {
  const deviceId = await getDeviceId();
  const base: PreCadastroRecord = {
    ...item,
    ownerUid,
    createdAt: item.criadoEm,
    updatedAt: item.criadoEm,
    version: 1,
    syncVersion: 1,
    deviceId,
    userId,
    updatedBy: userId ?? deviceId,
    syncStatus: syncStatusForOperation(operation),
    deleted: false,
    lastModifiedBy: deviceId,
  };
  return ensureRecordMeta(base, ownerUid);
}

export async function listPreCadastros(
  ownerUid: string,
  includeDeleted = false,
): Promise<PreCadastroRecord[]> {
  const db = getTafDatabase();
  if (!db) return [];
  const rows = await db.preCadastros.where('ownerUid').equals(ownerUid).toArray();
  const filtered = includeDeleted ? rows : rows.filter((r) => !r.deleted);
  return filtered.sort((a, b) => b.criadoEm - a.criadoEm);
}

export async function listPreCadastrosForSync(
  ownerUid: string,
  includeDeleted = false,
): Promise<PreCadastroRecord[]> {
  const loginUid = getCachedLoginUid();
  const sources = [ownerUid, ANONYMOUS_OWNER];
  if (loginUid && loginUid !== ownerUid && !sources.includes(loginUid)) {
    sources.push(loginUid);
  }
  const batches = await Promise.all(sources.map((uid) => listPreCadastros(uid, includeDeleted)));
  return mergePreCadastrosById(ownerUid, batches);
}

export async function putPreCadastroRecord(record: PreCadastroRecord): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.preCadastros.put(record);
}

export async function savePreCadastroRecord(
  item: PreCadastroTaf,
  ownerUid: string,
  userId: string | null,
): Promise<PreCadastroRecord> {
  const db = getTafDatabase();
  const existing = db ? await db.preCadastros.get(item.id) : undefined;
  const operation =
    existing && existing.ownerUid === ownerUid && !existing.deleted ? 'UPDATE' : 'CREATE';
  const record = await toPreCadastroRecord(
    existing && existing.ownerUid === ownerUid ? { ...existing, ...item } : item,
    ownerUid,
    userId,
    operation,
  );
  if (existing && existing.ownerUid === ownerUid) {
    record.createdAt = existing.createdAt;
  }
  await putPreCadastroRecord(record);
  return record;
}

export async function softDeletePreCadastroRecord(
  id: string,
  ownerUid: string,
  userId: string | null,
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const existing = await db.preCadastros.get(id);
  if (!existing || existing.ownerUid !== ownerUid || existing.deleted) return;
  const { bumpRecordMeta } = await import('../sync/recordMeta');
  const record = bumpRecordMeta(existing, await getDeviceId(), userId, 'DELETE');
  await putPreCadastroRecord(record);
}

export function preCadastroRecordToTaf(record: PreCadastroRecord): PreCadastroTaf {
  return {
    id: record.id,
    criadoEm: record.criadoEm,
    tipoProva: record.tipoProva,
    participantes: record.participantes,
  };
}

/** Migra fila legada do Dexie meta → tabela preCadastros com sync. */
export async function migratePreCadastrosFromAppMeta(ownerUid: string): Promise<number> {
  await hydrateAppMetaFromIndexedDb();
  const userId = getCachedLoginUid();
  let migrated = 0;
  const keys = new Set([ownerUid, 'local']);
  for (const key of keys) {
    const raw = await readAppMeta(preCadastroMetaKey(key));
    if (!raw?.trim()) continue;
    try {
      const parsed = JSON.parse(raw) as PreCadastroTaf[];
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        await savePreCadastroRecord(item, ownerUid, userId);
        migrated += 1;
      }
      await removeAppMeta(preCadastroMetaKey(key));
    } catch {
      // silencioso
    }
  }
  return migrated;
}

export async function wipePreCadastrosForOwner(ownerUid: string): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.preCadastros.where('ownerUid').equals(ownerUid).delete();
}
