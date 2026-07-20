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

/** Lê um único doc (owner_uid, id) — evita listar/descriptografar a tabela inteira. */
export async function getOwnerDoc(
  table: string,
  ownerUid: string,
  id: string,
): Promise<CloudDocRow | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(table)
    .select(selectColumns(table))
    .eq('owner_uid', ownerUid)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  try {
    const mapped = await mapDecryptedRows([data as CloudDocRow]);
    return mapped[0] ?? null;
  } catch {
    // Rubrica/doc único ilegível não deve derrubar o download do cadastro.
    return null;
  }
}

export const E2E_KEY_MISMATCH_CODE = 'E2E_KEY_MISMATCH';
export const E2E_KEY_MISMATCH_MESSAGE =
  'A chave de criptografia deste aparelho não abre os dados da nuvem (BNC). Saia da conta e entre novamente com e-mail e senha neste aparelho para alinhar a chave do banco.';

async function mapDecryptedRows(rows: CloudDocRow[]): Promise<CloudDocRow[]> {
  const out: CloudDocRow[] = [];
  let decryptFailures = 0;
  let encryptedSeen = 0;
  for (const row of rows) {
    const raw = row.data ?? {};
    if (isCloudDataEncrypted(raw)) encryptedSeen += 1;
    try {
      out.push({
        ...row,
        deleted: row.deleted ?? false,
        data: await maybeDecryptFromCloud(raw),
      });
    } catch (error) {
      decryptFailures += 1;
      console.warn(
        `[e2e] não foi possível descriptografar ${row.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  // Nenhum registro legível com a chave atual → chave errada neste aparelho.
  if (encryptedSeen > 0 && out.length === 0 && decryptFailures > 0) {
    const err = new Error(
      `${E2E_KEY_MISMATCH_CODE}: ${E2E_KEY_MISMATCH_MESSAGE} (${decryptFailures} registro(s) ilegíveis).`,
    );
    (err as Error & { code?: string }).code = E2E_KEY_MISMATCH_CODE;
    throw err;
  }
  // Parcial: mantém só os legíveis (órfãos de chave antiga serão sobrescritos no upload local).
  return out;
}

const HEAL_TABLES = [
  'cadastros',
  'cadastro_rubricas',
  'sessoes',
  'sessao_rubricas',
  'aplicadores',
  'aplicador_senhas',
  'pre_cadastros',
] as const;

/**
 * Após desbloquear a chave correta (senha): remove na nuvem docs cifrados
 * que esta chave não abre (lixo de chave antiga / outro aparelho).
 * Assim o próximo sync reenvia os dados locais com a chave alinhada.
 */
export async function purgeUndecryptableOwnerDocs(ownerUid: string): Promise<number> {
  if (!ownerUid.trim() || !getActiveTeamKey()) return 0;
  const sb = requireSupabase();
  let removed = 0;
  // No máximo 1 página por tabela — evita varrer a nuvem inteira no login.
  const maxPerTable = PAGE_SIZE;

  for (const table of HEAL_TABLES) {
    const { data, error } = await sb
      .from(table)
      .select('id, data')
      .eq('owner_uid', ownerUid)
      .order('id', { ascending: true })
      .range(0, maxPerTable - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Array<{ id: string; data: unknown }>;
    for (const row of chunk) {
      const payload = (row.data ?? {}) as Record<string, unknown>;
      if (!isCloudDataEncrypted(payload)) continue;
      try {
        await maybeDecryptFromCloud(payload);
      } catch {
        await deleteOwnerDoc(table, ownerUid, row.id);
        removed += 1;
      }
    }
  }

  return removed;
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
