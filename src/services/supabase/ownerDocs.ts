import { requireSupabase } from '../../config/supabase';
import { maybeDecryptFromCloud, maybeEncryptForCloud } from './e2eCrypto';

export type CloudDocRow = {
  id: string;
  owner_uid: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted?: boolean;
};

/** Tabelas com soft-delete (`deleted boolean`). Rubricas/senhas não têm essa coluna. */
const TABLES_WITH_DELETED = new Set([
  'cadastros',
  'sessoes',
  'aplicadores',
  'pre_cadastros',
]);

/** PostgREST/Supabase limita ~1000 por request — sem paginação o LWW acha que falta dado na nuvem. */
const PAGE_SIZE = 1000;

function tableSupportsDeleted(table: string): boolean {
  return TABLES_WITH_DELETED.has(table);
}

/** Upsert genérico de documento JSON por (owner_uid, id). */
export async function upsertOwnerDoc(
  table: string,
  ownerUid: string,
  id: string,
  data: Record<string, unknown>,
  updatedAt: number,
  deleted = false,
): Promise<void> {
  const sb = requireSupabase();
  const encrypted = await maybeEncryptForCloud({ ...data, id });
  const payload: Record<string, unknown> = {
    id,
    owner_uid: ownerUid,
    data: encrypted,
    updated_at: updatedAt || Date.now(),
  };
  if (tableSupportsDeleted(table)) {
    payload.deleted = deleted;
  }
  const { error } = await sb.from(table).upsert(payload, { onConflict: 'owner_uid,id' });
  if (error) throw new Error(error.message);
}

function selectColumns(table: string): string {
  return tableSupportsDeleted(table)
    ? 'id, owner_uid, data, updated_at, deleted'
    : 'id, owner_uid, data, updated_at';
}

async function mapDecryptedRows(rows: CloudDocRow[]): Promise<CloudDocRow[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      deleted: row.deleted ?? false,
      data: await maybeDecryptFromCloud(row.data ?? {}),
    })),
  );
}

/** Lista todos os docs do owner (paginado — evita corte em 1000). */
export async function listOwnerDocs(
  table: string,
  ownerUid: string,
): Promise<CloudDocRow[]> {
  const sb = requireSupabase();
  const all: CloudDocRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select(selectColumns(table))
      .eq('owner_uid', ownerUid)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as CloudDocRow[];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return mapDecryptedRows(all);
}

/** Lista documentos alterados desde um timestamp (sync incremental, paginado). */
export async function listOwnerDocsSince(
  table: string,
  ownerUid: string,
  sinceUpdatedAt: number,
): Promise<CloudDocRow[]> {
  const sb = requireSupabase();
  const all: CloudDocRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select(selectColumns(table))
      .eq('owner_uid', ownerUid)
      .gte('updated_at', sinceUpdatedAt)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as CloudDocRow[];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return mapDecryptedRows(all);
}

export async function deleteOwnerDoc(table: string, ownerUid: string, id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from(table).delete().eq('owner_uid', ownerUid).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function wipeOwnerTable(table: string, ownerUid: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from(table).delete().eq('owner_uid', ownerUid);
  if (error) throw new Error(error.message);
}

export function rowToDoc<T extends { id: string }>(row: CloudDocRow): T {
  return {
    ...(row.data as object),
    id: row.id,
    updatedAt: typeof (row.data as { updatedAt?: number }).updatedAt === 'number'
      ? (row.data as { updatedAt: number }).updatedAt
      : row.updated_at,
    deleted: row.deleted,
  } as unknown as T;
}
