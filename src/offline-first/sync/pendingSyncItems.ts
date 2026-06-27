import { getTafDatabase } from '../db/tafDatabase';
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

/** Retorna registros locais ainda não sincronizados (local, updated, deleted, conflict, pending). */
export async function getPendingSyncItems(ownerUid: string): Promise<PendingSyncSummary> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) {
    return { items: [], total: 0, cadastros: 0, sessoes: 0, aplicadores: 0 };
  }

  const [cadRows, sessRows, appRows] = await Promise.all([
    db.cadastros.where('ownerUid').equals(ownerUid).toArray(),
    db.sessoes.where('ownerUid').equals(ownerUid).toArray(),
    db.aplicadores.where('ownerUid').equals(ownerUid).toArray(),
  ]);

  const pendingCad = cadRows.filter((row) => isUnsyncedLocalStatus(row.syncStatus));
  const pendingSess = sessRows.filter((row) => isUnsyncedLocalStatus(row.syncStatus));
  const pendingApp = appRows.filter((row) => isUnsyncedLocalStatus(row.syncStatus));

  const items: PendingSyncItem[] = [
    ...pendingCad.map((row) => toPendingItem('cadastros', row)),
    ...pendingSess.map((row) => toPendingItem('sessoes', row)),
    ...pendingApp.map((row) => toPendingItem('aplicadores', row)),
  ];

  items.sort((a, b) => a.updatedAt - b.updatedAt);

  return {
    items,
    total: items.length,
    cadastros: pendingCad.length,
    sessoes: pendingSess.length,
    aplicadores: pendingApp.length,
  };
}
