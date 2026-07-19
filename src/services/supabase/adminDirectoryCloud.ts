import { requireSupabase } from '../../config/supabase';

export type AdminBossRow = {
  ownerUid: string;
  email: string;
  authorizedCount: number;
};

export type AdminAuthorizedRow = {
  email: string;
  ativo: boolean;
  criadoEm: string | null;
};

/** Lista e-mails chefe (RPC security definer — painel /admin/historico). */
export async function adminListBossEmails(): Promise<AdminBossRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_list_boss_emails');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { owner_uid: string; email: string; authorized_count: number | string }) => ({
    ownerUid: String(row.owner_uid),
    email: String(row.email ?? '').trim().toLowerCase(),
    authorizedCount: Number(row.authorized_count) || 0,
  }));
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
