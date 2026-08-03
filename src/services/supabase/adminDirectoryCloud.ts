import { requireSupabase } from '../../config/supabase';

export type AdminBossRow = {
  ownerUid: string;
  email: string;
  authorizedCount: number;
  /** Epoch ms — presente se a RPC admin incluir created_at. */
  createdAtMs: number | null;
};

export type AdminAuthorizedRow = {
  email: string;
  ativo: boolean;
  criadoEm: string | null;
};

/** Formata bytes para exibição (KB / MB / GB). */
export function formatAdminDataSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb < 10 ? 2 : 1)} GB`;
}

/** Tamanho atual total do banco Postgres do projeto Supabase. */
export async function adminDatabaseSizeBytes(): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_database_size_bytes');
  if (error) throw new Error(error.message);
  const n = typeof data === 'number' ? data : Number(data);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Resposta inválida do tamanho do banco.');
  }
  return Math.floor(n);
}

/** Lista e-mails chefe (RPC security definer — painel /admin/historico). */
export async function adminListBossEmails(): Promise<AdminBossRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_list_boss_emails');
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row: {
      owner_uid: string;
      email: string;
      authorized_count: number | string;
      created_at?: string | null;
    }) => {
      const createdRaw = row.created_at ? Date.parse(String(row.created_at)) : NaN;
      return {
        ownerUid: String(row.owner_uid),
        email: String(row.email ?? '').trim().toLowerCase(),
        authorizedCount: Number(row.authorized_count) || 0,
        createdAtMs: Number.isFinite(createdRaw) ? createdRaw : null,
      };
    },
  );
}

/** Lista e-mails autorizados de um chefe. */
export async function adminListAuthorizedEmails(bossUid: string): Promise<AdminAuthorizedRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_list_authorized_emails', { p_boss: bossUid });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row: { email: string; ativo: boolean | null; criado_em: string | null }) => ({
      email: String(row.email ?? '').trim().toLowerCase(),
      ativo: row.ativo !== false,
      criadoEm: row.criado_em ?? null,
    }),
  );
}
