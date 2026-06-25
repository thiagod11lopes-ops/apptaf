import { getTafDatabase } from '../db/tafDatabase';
import type { CadastroRecord, CollectionName, SessaoRecord } from '../types';

export type PendingSyncItem = {
  collection: CollectionName;
  id: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  deviceId: string;
  syncStatus: 'pending';
  record: CadastroRecord | SessaoRecord;
};

export type PendingSyncSummary = {
  items: PendingSyncItem[];
  total: number;
  cadastros: number;
  sessoes: number;
};

/** Retorna todos os registros locais com syncStatus === "pending". */
export async function getPendingSyncItems(ownerUid: string): Promise<PendingSyncSummary> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) {
    return { items: [], total: 0, cadastros: 0, sessoes: 0 };
  }

  const [cadRows, sessRows] = await Promise.all([
    db.cadastros.where('[ownerUid+syncStatus]').equals([ownerUid, 'pending']).toArray(),
    db.sessoes.where('[ownerUid+syncStatus]').equals([ownerUid, 'pending']).toArray(),
  ]);

  const items: PendingSyncItem[] = [];

  for (const row of cadRows) {
    items.push({
      collection: 'cadastros',
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
      deviceId: row.deviceId,
      syncStatus: 'pending',
      record: row,
    });
  }

  for (const row of sessRows) {
    items.push({
      collection: 'sessoes',
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
      deviceId: row.deviceId,
      syncStatus: 'pending',
      record: row,
    });
  }

  items.sort((a, b) => a.updatedAt - b.updatedAt);

  return {
    items,
    total: items.length,
    cadastros: cadRows.length,
    sessoes: sessRows.length,
  };
}
