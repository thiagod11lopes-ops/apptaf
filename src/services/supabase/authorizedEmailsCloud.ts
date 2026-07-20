import { getSupabase, requireSupabase } from '../../config/supabase';
import { isAllowedAuthEmail, authEmailDomainErrorMessage, normalizeAuthEmail } from '../../utils/normalizeAuthEmail';
import { isCloudOwnerUid } from '../../utils/cloudOwnerUid';
import { readAppMetaCache } from '../../offline-first/db/appMeta';

export type AuthorizedEmailEntry = {
  email: string;
  ativo: boolean;
  criadoEm?: unknown;
};

export type MemberAccess = {
  dataOwnerUid: string;
  isAuthorizedMember: boolean;
};

function readPersistedMemberSession(): { loginUid: string; dataOwnerUid: string } | null {
  const loginUid = readAppMetaCache('session:loginUid');
  const dataOwnerUid = readAppMetaCache('session:dataOwnerUid');
  if (!loginUid || !dataOwnerUid || loginUid === dataOwnerUid) return null;
  // Ignora sessão membro com owner legado (Firebase) — incompatível com uuid do Supabase.
  if (!isCloudOwnerUid(dataOwnerUid)) return null;
  return { loginUid, dataOwnerUid };
}

function fallbackMemberAccessFromPersistedSession(loginUid: string): MemberAccess {
  const persisted = readPersistedMemberSession();
  if (persisted?.loginUid === loginUid && isCloudOwnerUid(persisted.dataOwnerUid)) {
    return { dataOwnerUid: persisted.dataOwnerUid, isAuthorizedMember: true };
  }
  return { dataOwnerUid: loginUid, isAuthorizedMember: false };
}

function memberAccessFromBoss(
  loginUid: string,
  bossUid: string | null | undefined,
): MemberAccess | null {
  if (
    bossUid &&
    isCloudOwnerUid(bossUid) &&
    bossUid !== loginUid
  ) {
    return { dataOwnerUid: bossUid, isAuthorizedMember: true };
  }
  return null;
}

/**
 * Consulta na nuvem se o e-mail/UID é membro autorizado (banco do chefe)
 * ou conta própria (banco do próprio login).
 */
export async function resolveMemberAccess(
  loginUid: string,
  email: string | null | undefined,
): Promise<MemberAccess> {
  if (!isCloudOwnerUid(loginUid)) {
    return { dataOwnerUid: loginUid, isAuthorizedMember: false };
  }
  const sb = getSupabase();
  if (!sb) return fallbackMemberAccessFromPersistedSession(loginUid);

  try {
    if (email?.trim()) {
      const emailKey = normalizeAuthEmail(email);

      // Preferência: RPC SECURITY DEFINER (confiável mesmo com RLS restritivo).
      const { data: rpcBoss, error: rpcError } = await sb.rpc('resolve_member_boss', {
        p_email: emailKey,
      });
      if (!rpcError) {
        const fromRpc = memberAccessFromBoss(loginUid, rpcBoss as string | null);
        if (fromRpc) return fromRpc;
      } else if (!/could not find the function|schema cache|404/i.test(rpcError.message)) {
        console.warn('[auth] resolve_member_boss:', rpcError.message);
      }

      const { data, error } = await sb
        .from('member_lookup')
        .select('boss_uid, ativo')
        .eq('email_key', emailKey)
        .maybeSingle();
      if (error) {
        console.warn('[auth] member_lookup:', error.message);
      } else {
        const fromEmail = memberAccessFromBoss(
          loginUid,
          data?.ativo === true ? (data.boss_uid as string) : null,
        );
        if (fromEmail) return fromEmail;
      }
    }

    if (loginUid.trim()) {
      const { data, error } = await sb
        .from('member_uid_lookup')
        .select('boss_uid, ativo')
        .eq('member_uid', loginUid)
        .maybeSingle();
      if (error) {
        console.warn('[auth] member_uid_lookup:', error.message);
      } else {
        const fromUid = memberAccessFromBoss(
          loginUid,
          data && data.ativo !== false ? (data.boss_uid as string) : null,
        );
        if (fromUid) return fromUid;
      }
    }
  } catch (error) {
    console.warn('[auth] resolveMemberAccess falhou:', error);
    return fallbackMemberAccessFromPersistedSession(loginUid);
  }
  return fallbackMemberAccessFromPersistedSession(loginUid);
}

export async function registerAuthorizedMemberLogin(
  bossUid: string,
  email: string,
  memberUid: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!memberUid.trim() || memberUid === bossUid) return { ok: true };
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);

  // Preferência: RPC (evita falha de INSERT RLS no upsert de member_lookup pelo membro).
  const { data: rpcOk, error: rpcError } = await sb.rpc('register_authorized_member_login', {
    p_boss_uid: bossUid,
    p_email: emailKey,
    p_member_uid: memberUid,
  });
  if (!rpcError) {
    return rpcOk === false
      ? { ok: false, error: 'E-mail não está autorizado na nuvem do chefe.' }
      : { ok: true };
  }
  if (!/could not find the function|schema cache|404/i.test(rpcError.message)) {
    // RPC existe mas falhou — não mascara com upsert legado.
    return { ok: false, error: rpcError.message };
  }

  // Fallback legado (projetos sem fix_member_login.sql).
  const now = new Date().toISOString();
  const { error: e1 } = await sb.from('member_lookup').upsert({
    email_key: emailKey,
    email: emailKey,
    boss_uid: bossUid,
    ativo: true,
    member_uid: memberUid,
    last_login_at: now,
  });
  if (e1) {
    // UPDATE parcial: membro pode atualizar a própria linha por e-mail.
    const { error: updErr } = await sb
      .from('member_lookup')
      .update({
        member_uid: memberUid,
        last_login_at: now,
        ativo: true,
      })
      .eq('email_key', emailKey)
      .eq('boss_uid', bossUid);
    if (updErr) return { ok: false, error: e1.message };
  }
  const { error: e2 } = await sb.from('member_uid_lookup').upsert({
    member_uid: memberUid,
    boss_uid: bossUid,
    ativo: true,
    email: emailKey,
    last_login_at: now,
  });
  if (e2) return { ok: false, error: e2.message };
  return { ok: true };
}

export async function listAuthorizedEmails(ownerUid: string): Promise<AuthorizedEmailEntry[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('authorized_emails')
    .select('email, ativo, criado_em')
    .eq('owner_uid', ownerUid);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    email: row.email,
    ativo: row.ativo !== false,
    criadoEm: row.criado_em,
  }));
}

export async function addAuthorizedEmail(
  ownerUid: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isAllowedAuthEmail(email)) return { ok: false, error: authEmailDomainErrorMessage() };
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);
  const id = emailKey;

  // Já na nuvem e ativo: não regrava (evita UPDATE → Realtime → loop de sync).
  const { data: existing, error: readErr } = await sb
    .from('authorized_emails')
    .select('id, ativo, criado_em')
    .eq('owner_uid', ownerUid)
    .eq('id', id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  if (!existing || existing.ativo === false) {
    const { error } = await sb.from('authorized_emails').upsert({
      id,
      owner_uid: ownerUid,
      email: emailKey,
      ativo: true,
      criado_em: existing?.criado_em ?? new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
  }

  const { error: lookupErr } = await sb.from('member_lookup').upsert({
    email_key: emailKey,
    email: emailKey,
    boss_uid: ownerUid,
    ativo: true,
  });
  // authorized_emails já ok — falha no lookup não deve manter pendência local em loop.
  if (lookupErr) {
    console.warn('[auth] member_lookup após autorizar e-mail:', lookupErr.message);
  }
  return { ok: true };
}

export async function removeAuthorizedEmail(
  ownerUid: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);
  await sb.from('authorized_emails').delete().eq('owner_uid', ownerUid).eq('id', emailKey);
  const { data: lookup } = await sb
    .from('member_lookup')
    .select('member_uid')
    .eq('email_key', emailKey)
    .eq('boss_uid', ownerUid)
    .maybeSingle();
  await sb.from('member_lookup').delete().eq('email_key', emailKey).eq('boss_uid', ownerUid);
  if (lookup?.member_uid) {
    await sb
      .from('member_uid_lookup')
      .delete()
      .eq('member_uid', lookup.member_uid)
      .eq('boss_uid', ownerUid);
  }
  try {
    const { removeMemberE2eWrap } = await import('./teamE2eSession');
    await removeMemberE2eWrap(ownerUid, emailKey);
  } catch (error) {
    console.warn('[auth] removeMemberE2eWrap:', error);
  }
  return { ok: true };
}

export async function listMemberLoginUidsForBoss(bossUid: string): Promise<string[]> {
  const sb = requireSupabase();
  const { data } = await sb
    .from('member_uid_lookup')
    .select('member_uid')
    .eq('boss_uid', bossUid);
  return (data ?? []).map((r) => r.member_uid).filter(Boolean);
}
