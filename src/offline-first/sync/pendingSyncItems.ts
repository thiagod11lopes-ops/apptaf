import { getTafDatabase } from '../db/tafDatabase';
import { ANONYMOUS_OWNER } from '../db/localDb';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import type {
  AplicadorRecord,
  CadastroRecord,
  CollectionName,
  PreCadastroRecord,
  SessaoRecord,
  SyncStatus,
} from '../types';
import { markRecordSynced } from './recordMeta';
import { isUnsyncedLocalStatus } from './syncStatus';
import { syncQueue } from './SyncQueue';
import { syncLogger } from './SyncLogger';

export type PendingSyncItem = {
  collection: CollectionName;
  id: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  deviceId: string;
  syncStatus: SyncStatus;
  record: CadastroRecord | SessaoRecord | AplicadorRecord | PreCadastroRecord;
};

export type PendingSyncSummary = {
  items: PendingSyncItem[];
  total: number;
  cadastros: number;
  /** Cadastros pendentes que podem ser dispensados (exclui exclusões aguardando envio). */
  cadastrosDispensaveis: number;
  sessoes: number;
  aplicadores: number;
  pre_cadastros: number;
};

function toPendingItem(
  collection: CollectionName,
  row: CadastroRecord | SessaoRecord | AplicadorRecord | PreCadastroRecord,
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
    return {
      items: [],
      total: 0,
      cadastros: 0,
      cadastrosDispensaveis: 0,
      sessoes: 0,
      aplicadores: 0,
      pre_cadastros: 0,
    };
  }

  const seen = new Set<string>();
  const items: PendingSyncItem[] = [];
  let cadastros = 0;
  let cadastrosDispensaveis = 0;
  let sessoes = 0;
  let aplicadores = 0;
  let pre_cadastros = 0;

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
      if (row.deleted !== true) cadastrosDispensaveis += 1;
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
    cadastrosDispensaveis,
    sessoes,
    aplicadores,
    pre_cadastros,
  };
}

/**
 * Marca cadastros pendentes como sincronizados localmente, sem envio à nuvem.
 * Não altera sessões, aplicadores nem outros tipos de dado.
 * Exclusões pendentes (deleted) são preservadas na fila de envio.
 */
export async function dismissPendingCadastroUploads(ownerUid: string): Promise<number> {
  const db = getTafDatabase();
  const owners = ownerUidsForQuery(ownerUid);
  if (!db || owners.length === 0) return 0;

  const loginUid = getCachedLoginUid();
  let dismissed = 0;

  for (const uid of owners) {
    const rows = await db.cadastros.where('ownerUid').equals(uid).toArray();
    const pending = rows.filter(
      (row) => isUnsyncedLocalStatus(row.syncStatus) && row.deleted !== true,
    );
    if (pending.length === 0) continue;

    const synced = pending.map((row) => markRecordSynced(row, loginUid));
    await db.cadastros.bulkPut(synced);
    await syncQueue.clearPendingForCollection(uid, 'cadastros');
    dismissed += synced.length;
  }

  if (dismissed > 0) {
    await syncLogger.info(
      'sync',
      `Envio de cadastros dispensado manualmente (${dismissed} registro(s))`,
      { ownerUid },
    );
  }

  return dismissed;
}
