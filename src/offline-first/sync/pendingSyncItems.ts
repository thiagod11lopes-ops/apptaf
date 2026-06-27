import { getTafDatabase } from '../db/tafDatabase';
import { ANONYMOUS_OWNER } from '../db/localDb';
import type { AplicadorRecord, CadastroRecord, CollectionName, SessaoRecord, SyncStatus } from '../types';
import { isUnsyncedLocalStatus } from './syncStatus';

export type PendingSyncItem = {
  collection: CollectionName;
  id: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  deviceId: string;
  syncStatus: SyncStatus;
  record: CadastroRecord | SessaoRecord | AplicadorRecord;
};

export type PendingSyncSummary = {
  items: PendingSyncItem[];
  total: number;
  cadastros: number;
  sessoes: number;
  aplicadores: number;
};

function toPendingItem(
  collection: CollectionName,
  row: CadastroRecord | SessaoRecord | AplicadorRecord,
): PendingSyncItem {
  return {
    collection,
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    deviceId: row.deviceId,
    syncStatus: row.syncStatus,
    record: row,
  };
}

function ownerUidsForQuery(ownerUid: string): string[] {
  if (!ownerUid.trim()) return [];
  if (ownerUid === ANONYMOUS_OWNER) return [ANONYMOUS_OWNER];
  return [ownerUid, ANONYMOUS_OWNER];
}

/** Retorna registros locais ainda não sincronizados (local, updated, deleted, conflict, pending). */
export async function getPendingSyncItems(ownerUid: string): Promise<PendingSyncSummary> {
  const db = getTafDatabase();
  const owners = ownerUidsForQuery(ownerUid);
  if (!db || owners.length === 0) {
    return { items: [], total: 0, cadastros: 0, sessoes: 0, aplicadores: 0 };
  }

  const seen = new Set<string>();
  const items: PendingSyncItem[] = [];
  let cadastros = 0;
  let sessoes = 0;
  let aplicadores = 0;

  for (const uid of owners) {
    const [cadRows, sessRows, appRows] = await Promise.all([
      db.cadastros.where('ownerUid').equals(uid).toArray(),
      db.sessoes.where('ownerUid').equals(uid).toArray(),
      db.aplicadores.where('ownerUid').equals(uid).toArray(),
    ]);

    for (const row of cadRows.filter((r) => isUnsyncedLocalStatus(r.syncStatus))) {
      const key = `cadastros:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(toPendingItem('cadastros', row));
      cadastros += 1;
    }
    for (const row of sessRows.filter((r) => isUnsyncedLocalStatus(r.syncStatus))) {
      const key = `sessoes:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(toPendingItem('sessoes', row));
      sessoes += 1;
    }
    for (const row of appRows.filter((r) => isUnsyncedLocalStatus(r.syncStatus))) {
      const key = `aplicadores:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(toPendingItem('aplicadores', row));
      aplicadores += 1;
    }
  }

  items.sort((a, b) => a.updatedAt - b.updatedAt);

  return {
    items,
    total: items.length,
    cadastros,
    sessoes,
    aplicadores,
  };
}
