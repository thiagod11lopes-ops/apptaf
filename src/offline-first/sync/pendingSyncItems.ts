import { getTafDatabase } from '../db/tafDatabase';
import { ANONYMOUS_OWNER } from '../db/localDb';
import type {
  AplicadorRecord,
  CadastroRecord,
  CollectionName,
  PreCadastroRecord,
  SessaoRecord,
  SyncStatus,
} from '../types';
import {
  LEGACY_PENDING,
  STATUS_CONFLICT,
  STATUS_DELETED,
  STATUS_LOCAL,
  STATUS_UPDATED,
  isUnsyncedLocalStatus,
} from './syncStatus';

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
  sessoes: number;
  aplicadores: number;
  pre_cadastros: number;
  /** E-mails autorizados aguardando envio à nuvem (não entram em items/SyncQueue). */
  authorizedEmails: number;
};

/** Status locais que precisam subir — evita full-scan de synced. */
const UNSYNCED_STATUSES: readonly SyncStatus[] = [
  STATUS_LOCAL,
  STATUS_UPDATED,
  STATUS_DELETED,
  LEGACY_PENDING,
  STATUS_CONFLICT,
];

function toPendingItem(
  collection: CollectionName,
  row: CadastroRecord | SessaoRecord | AplicadorRecord | PreCadastroRecord,
): PendingSyncItem {
  return {
    collection,
    id: row.id,
    createdAt: row.createdAt ?? 0,
    updatedAt: row.updatedAt ?? 0,
    version: row.version ?? 0,
    deviceId: row.deviceId ?? '',
    syncStatus: row.syncStatus,
    record: row,
  };
}

function ownerUidsForQuery(ownerUid: string): string[] {
  if (!ownerUid.trim()) return [];
  if (ownerUid === ANONYMOUS_OWNER) return [ANONYMOUS_OWNER];
  return [ownerUid, ANONYMOUS_OWNER];
}

async function queryUnsyncedByOwnerStatus<T extends CadastroRecord | SessaoRecord | AplicadorRecord>(
  table: {
    where: (index: string) => {
      equals: (key: [string, SyncStatus]) => { toArray: () => Promise<T[]> };
    };
  },
  ownerUid: string,
): Promise<T[]> {
  const batches = await Promise.all(
    UNSYNCED_STATUSES.map((status) =>
      table.where('[ownerUid+syncStatus]').equals([ownerUid, status]).toArray(),
    ),
  );
  return batches.flat();
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
      sessoes: 0,
      aplicadores: 0,
      pre_cadastros: 0,
      authorizedEmails: 0,
    };
  }

  const seen = new Set<string>();
  const items: PendingSyncItem[] = [];
  let cadastros = 0;
  let sessoes = 0;
  let aplicadores = 0;
  const pre_cadastros = 0;

  for (const uid of owners) {
    const [cadRows, sessRows, appRows] = await Promise.all([
      queryUnsyncedByOwnerStatus(db.cadastros, uid),
      queryUnsyncedByOwnerStatus(db.sessoes, uid),
      queryUnsyncedByOwnerStatus(db.aplicadores, uid),
    ]);

    for (const row of cadRows) {
      if (!isUnsyncedLocalStatus(row.syncStatus)) continue;
      const key = `cadastros:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(toPendingItem('cadastros', row));
      cadastros += 1;
    }
    for (const row of sessRows) {
      if (!isUnsyncedLocalStatus(row.syncStatus)) continue;
      const key = `sessoes:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(toPendingItem('sessoes', row));
      sessoes += 1;
    }
    for (const row of appRows) {
      if (!isUnsyncedLocalStatus(row.syncStatus)) continue;
      const key = `aplicadores:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(toPendingItem('aplicadores', row));
      aplicadores += 1;
    }
  }

  items.sort((a, b) => a.updatedAt - b.updatedAt);

  let authorizedEmails = 0;
  for (const uid of owners) {
    const [localEmails, deletedEmails] = await Promise.all([
      db.authorizedEmails.where('[ownerUid+syncStatus]').equals([uid, 'local']).toArray(),
      db.authorizedEmails.where('[ownerUid+syncStatus]').equals([uid, 'deleted']).toArray(),
    ]);
    authorizedEmails += localEmails.length + deletedEmails.length;
  }

  return {
    items,
    total: items.length + authorizedEmails,
    cadastros,
    sessoes,
    aplicadores,
    pre_cadastros,
    authorizedEmails,
  };
}
