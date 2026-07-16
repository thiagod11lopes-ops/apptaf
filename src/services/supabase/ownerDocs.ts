import { requireSupabase } from '../../config/supabase';
import { maybeDecryptFromCloud, maybeEncryptForCloud } from './e2eCrypto';

export type CloudDocRow = {
  id: string;
  owner_uid: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted?: boolean;
};

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
  const payload: CloudDocRow = {
    id,
    owner_uid: ownerUid,
    data: encrypted,
    updated_at: updatedAt || Date.now(),
    deleted,
  };
  const { error } = await sb.from(table).upsert(payload, { onConflict: 'owner_uid,id' });
  if (error) throw new Error(error.message);
}

export async function listOwnerDocs(
  table: string,
  ownerUid: string,
): Promise<CloudDocRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(table)
    .select('id, owner_uid, data, updated_at, deleted')
    .eq('owner_uid', ownerUid);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CloudDocRow[];
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      data: await maybeDecryptFromCloud(row.data ?? {}),
    })),
  );
}

/** Lista documentos alterados desde um timestamp (sync incremental). */
export async function listOwnerDocsSince(
  table: string,
  ownerUid: string,
  sinceUpdatedAt: number,
): Promise<CloudDocRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(table)
    .select('id, owner_uid, data, updated_at, deleted')
    .eq('owner_uid', ownerUid)
    .gte('updated_at', sinceUpdatedAt);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CloudDocRow[];
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      data: await maybeDecryptFromCloud(row.data ?? {}),
    })),
  );
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
