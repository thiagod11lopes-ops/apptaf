/**
 * Leitura de tombstones remotos exclusiva para o motor de sync.
 * Usa só metadados (id, updated_at, deleted) — não baixa a coluna `data`.
 * Não altera listagens da UI (getAll*Firestore* continuam filtrando deleted).
 */

import type { TombstonePayload } from '../../offline-first/sync/tombstone';
import {
  listOwnerDeletedDocMetadata,
  listOwnerDeletedDocMetadataSince,
  rowToDoc,
  type CloudDocRow,
  type OwnerDocMetadata,
} from './ownerDocs';

const TABLES = {
  cadastros: 'cadastros',
  sessoes: 'sessoes',
  aplicadores: 'aplicadores',
} as const;

export type SyncTombstoneCollection = keyof typeof TABLES;

/** Converte metadados de soft-delete em tombstone mínimo para o LWW. */
export function metadataToSyncTombstone(meta: OwnerDocMetadata): TombstonePayload {
  const updatedAt =
    typeof meta.updated_at === 'number' && meta.updated_at > 0
      ? meta.updated_at
      : Date.now();
  return {
    id: meta.id,
    updatedAt,
    deleted: true,
    deletedAt: updatedAt,
  };
}

/**
 * Converte linha completa da nuvem em tombstone (legado / testes).
 * Preferir `metadataToSyncTombstone` no caminho de sync.
 */
export function cloudRowToSyncTombstone(row: CloudDocRow): TombstonePayload | null {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const isDeleted = row.deleted === true || data.deleted === true;
  if (!isDeleted) return null;

  const raw = rowToDoc<Record<string, unknown>>(row);

  const updatedAt =
    typeof data.updatedAt === 'number' && data.updatedAt > 0
      ? data.updatedAt
      : typeof raw.updatedAt === 'number' && raw.updatedAt > 0
        ? raw.updatedAt
        : row.updated_at;

  return {
    id: row.id,
    updatedAt,
    deleted: true,
    deletedAt:
      typeof data.deletedAt === 'number' && data.deletedAt > 0
        ? data.deletedAt
        : typeof raw.deletedAt === 'number' && raw.deletedAt > 0
          ? raw.deletedAt
          : updatedAt,
    deletedBy:
      typeof data.deletedBy === 'string'
        ? data.deletedBy
        : typeof raw.deletedBy === 'string'
          ? raw.deletedBy
          : undefined,
    syncVersion:
      typeof data.syncVersion === 'number'
        ? data.syncVersion
        : typeof data.version === 'number'
          ? data.version
          : typeof raw.syncVersion === 'number'
            ? raw.syncVersion
            : typeof raw.version === 'number'
              ? raw.version
              : undefined,
    updatedBy:
      typeof data.updatedBy === 'string'
        ? data.updatedBy
        : typeof raw.updatedBy === 'string'
          ? raw.updatedBy
          : undefined,
    deviceId:
      typeof data.deviceId === 'string'
        ? data.deviceId
        : typeof raw.deviceId === 'string'
          ? raw.deviceId
          : undefined,
  };
}

async function listTombstonesForSync(table: string, uid: string): Promise<TombstonePayload[]> {
  const rows = await listOwnerDeletedDocMetadata(table, uid);
  return rows.map(metadataToSyncTombstone);
}

async function listTombstonesSinceForSync(
  table: string,
  uid: string,
  sinceUpdatedAt: number,
): Promise<TombstonePayload[]> {
  const rows = await listOwnerDeletedDocMetadataSince(table, uid, sinceUpdatedAt);
  return rows.map(metadataToSyncTombstone);
}

export async function listCadastrosTombstonesForSync(uid: string): Promise<TombstonePayload[]> {
  return listTombstonesForSync(TABLES.cadastros, uid);
}

export async function listCadastrosTombstonesSinceForSync(
  uid: string,
  sinceUpdatedAt: number,
): Promise<TombstonePayload[]> {
  return listTombstonesSinceForSync(TABLES.cadastros, uid, sinceUpdatedAt);
}

export async function listSessoesTombstonesForSync(uid: string): Promise<TombstonePayload[]> {
  return listTombstonesForSync(TABLES.sessoes, uid);
}

export async function listSessoesTombstonesSinceForSync(
  uid: string,
  sinceUpdatedAt: number,
): Promise<TombstonePayload[]> {
  return listTombstonesSinceForSync(TABLES.sessoes, uid, sinceUpdatedAt);
}

export async function listAplicadoresTombstonesForSync(uid: string): Promise<TombstonePayload[]> {
  return listTombstonesForSync(TABLES.aplicadores, uid);
}

export async function listAplicadoresTombstonesSinceForSync(
  uid: string,
  sinceUpdatedAt: number,
): Promise<TombstonePayload[]> {
  return listTombstonesSinceForSync(TABLES.aplicadores, uid, sinceUpdatedAt);
}
