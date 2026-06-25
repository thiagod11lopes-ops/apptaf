import Dexie, { type Table } from 'dexie';
import type {
  CadastroRecord,
  SessaoRecord,
  SyncQueueEntry,
  ChangeLogEntry,
  SyncLogEntry,
} from '../types';

export type MetaEntry = { key: string; value: string };

export class TafDatabase extends Dexie {
  cadastros!: Table<CadastroRecord, string>;
  sessoes!: Table<SessaoRecord, string>;
  syncQueue!: Table<SyncQueueEntry, string>;
  changeLog!: Table<ChangeLogEntry, number>;
  syncLogs!: Table<SyncLogEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('taf_offline_first_v1');
    this.version(1).stores({
      cadastros: 'id, ownerUid, nip, updatedAt, syncStatus, deleted, [ownerUid+deleted], [ownerUid+syncStatus]',
      sessoes: 'id, ownerUid, criadoEm, updatedAt, syncStatus, deleted, [ownerUid+deleted]',
      syncQueue: 'operationId, status, timestamp, ownerUid, [ownerUid+status], [status+timestamp]',
      changeLog: '++id, documentId, collection, timestamp, [collection+timestamp]',
      syncLogs: '++id, category, level, timestamp',
      meta: 'key',
    });
  }
}

let dbInstance: TafDatabase | null = null;

export function getTafDatabase(): TafDatabase | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbInstance) {
    dbInstance = new TafDatabase();
  }
  return dbInstance;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = getTafDatabase();
  if (!db) return null;
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.meta.put({ key, value });
}
