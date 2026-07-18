import { requireSupabase } from '../../config/supabase';
import { getActiveTeamKey, isCloudDataEncrypted, maybeDecryptFromCloud, maybeEncryptForCloud } from './e2eCrypto';

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
  return listOwnerDocsAfterCursor(table, ownerUid, { updated_at: sinceUpdatedAt, id: '' }, Number.MAX_SAFE_INTEGER);
}

export type OwnerDocCursor = { updated_at: number; id: string };

/**
 * Paginação keyset estável: (updated_at, id) > cursor AND updated_at <= upperBound.
 * Inclui tombstones (coluna deleted) — não filtra deleted=false.
 */
export async function listOwnerDocsAfterCursor(
  table: string,
  ownerUid: string,
  cursor: OwnerDocCursor,
  upperBound: number,
): Promise<CloudDocRow[]> {
  const sb = requireSupabase();
  const all: CloudDocRow[] = [];
  let pageCursor: OwnerDocCursor = { ...cursor };

  for (;;) {
    let query = sb
      .from(table)
      .select(selectColumns(table))
      .eq('owner_uid', ownerUid)
      .lte('updated_at', upperBound)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);

    // Primeira página após watermark: updated_at >= cursor (overlap seguro).
    // Páginas seguintes: keyset estrito (updated_at, id) > pageCursor.
    if (!pageCursor.id) {
      query = query.gte('updated_at', pageCursor.updated_at);
    } else {
      query = query.or(
        `and(updated_at.gt.${pageCursor.updated_at}),and(updated_at.eq.${pageCursor.updated_at},id.gt.${pageCursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as CloudDocRow[];
    if (chunk.length === 0) break;
    all.push(...chunk);
    const last = chunk[chunk.length - 1]!;
    pageCursor = { updated_at: last.updated_at, id: last.id };
    if (chunk.length < PAGE_SIZE) break;
  }

  return mapDecryptedRows(all);
}

/** Metadados públicos sem decrypt — id/owner_uid/updated_at/deleted. */
export async function listOwnerDocMetadata(
  table: string,
  ownerUid: string,
): Promise<Array<{ id: string; owner_uid: string; updated_at: number; deleted: boolean }>> {
  const sb = requireSupabase();
  const all: Array<{ id: string; owner_uid: string; updated_at: number; deleted: boolean }> = [];
  let from = 0;
  const cols = tableSupportsDeleted(table)
    ? 'id, owner_uid, updated_at, deleted'
    : 'id, owner_uid, updated_at';

  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .eq('owner_uid', ownerUid)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Array<{
      id: string;
      owner_uid: string;
      updated_at: number;
      deleted?: boolean;
    }>;
    for (const row of chunk) {
      all.push({
        id: row.id,
        owner_uid: row.owner_uid,
        updated_at: row.updated_at,
        deleted: row.deleted === true,
      });
    }
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/** IDs na nuvem ainda em texto plano (precisam reenvio com E2E ativo). */
export async function listPlaintextCloudDocIds(
  table: string,
  ownerUid: string,
): Promise<Set<string>> {
  if (!getActiveTeamKey()) {
    throw new Error(
      'Criptografia E2E obrigatória: chave da equipe não está ativa. Saia e entre novamente com e-mail e senha.',
    );
  }
  const sb = requireSupabase();
  const plain = new Set<string>();
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select('id, data')
      .eq('owner_uid', ownerUid)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Array<{ id: string; data: unknown }>;
    for (const row of chunk) {
      if (!isCloudDataEncrypted(row.data ?? {})) plain.add(row.id);
    }
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return plain;
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
