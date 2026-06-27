import Dexie, { type Table } from 'dexie';
import type {
  AplicadorRecord,
  CadastroRecord,
  SessaoRecord,
  SyncQueueEntry,
  ChangeLogEntry,
  SyncLogEntry,
  SyncAuditEntry,
  LocalBackupSnapshot,
  PreCadastroRecord,
} from '../types';
import type { LocalAuthorizedEmail } from '../repositories/AuthorizedEmailRepository';

export type MetaEntry = { key: string; value: string };

export class TafDatabase extends Dexie {
  cadastros!: Table<CadastroRecord, string>;
  aplicadores!: Table<AplicadorRecord, string>;
  sessoes!: Table<SessaoRecord, string>;
  syncQueue!: Table<SyncQueueEntry, string>;
  changeLog!: Table<ChangeLogEntry, number>;
  syncLogs!: Table<SyncLogEntry, number>;
  syncAuditHistory!: Table<SyncAuditEntry, number>;
  localBackups!: Table<LocalBackupSnapshot, number>;
  authorizedEmails!: Table<LocalAuthorizedEmail, string>;
  preCadastros!: Table<PreCadastroRecord, string>;
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
    this.version(2).stores({
      sessoes: 'id, ownerUid, criadoEm, updatedAt, syncStatus, deleted, [ownerUid+deleted], [ownerUid+syncStatus]',
    });
    this.version(3).stores({
      aplicadores: 'id, ownerUid, nip, updatedAt, deleted, [ownerUid+deleted]',
    });
    this.version(4).stores({
      aplicadores:
        'id, ownerUid, nip, updatedAt, syncStatus, deleted, [ownerUid+deleted], [ownerUid+syncStatus]',
    });
    this.version(5).stores({
      syncAuditHistory: '++id, ownerUid, startedAt, [ownerUid+startedAt]',
    });
    this.version(6).stores({
      localBackups: '++id, ownerUid, createdAt, [ownerUid+createdAt]',
      authorizedEmails: 'id, ownerUid, email, syncStatus, [ownerUid+syncStatus]',
    });
    this.version(7).stores({
      preCadastros:
        'id, ownerUid, criadoEm, updatedAt, syncStatus, deleted, [ownerUid+deleted], [ownerUid+syncStatus]',
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

/** Limpa o banco Dexie entre testes automatizados. */
export async function closeTafDatabaseForTests(): Promise<void> {
  if (!dbInstance) return;
  dbInstance.close();
  await dbInstance.delete();
  dbInstance = null;
}

/** Simula reload da página mantendo IndexedDB. */
export function resetTafDatabaseConnectionForTests(): void {
  if (!dbInstance) return;
  dbInstance.close();
  dbInstance = null;
}
