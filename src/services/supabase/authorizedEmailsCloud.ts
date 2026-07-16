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
      const { data } = await sb
        .from('member_lookup')
        .select('boss_uid, ativo')
        .eq('email_key', emailKey)
        .maybeSingle();
      if (
        data?.ativo === true &&
        data.boss_uid &&
        isCloudOwnerUid(data.boss_uid) &&
        data.boss_uid !== loginUid
      ) {
        return { dataOwnerUid: data.boss_uid, isAuthorizedMember: true };
      }
    }
    if (loginUid.trim()) {
      const { data } = await sb
        .from('member_uid_lookup')
        .select('boss_uid, ativo')
        .eq('member_uid', loginUid)
        .maybeSingle();
      if (
        data &&
        data.ativo !== false &&
        data.boss_uid &&
        isCloudOwnerUid(data.boss_uid) &&
        data.boss_uid !== loginUid
      ) {
        return { dataOwnerUid: data.boss_uid, isAuthorizedMember: true };
      }
    }
  } catch {
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
  const now = new Date().toISOString();
  const { error: e1 } = await sb.from('member_lookup').upsert({
    email_key: emailKey,
    email: emailKey,
    boss_uid: bossUid,
    ativo: true,
    member_uid: memberUid,
    last_login_at: now,
  });
  if (e1) return { ok: false, error: e1.message };
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
  const { error } = await sb.from('authorized_emails').upsert({
    id,
    owner_uid: ownerUid,
    email: emailKey,
    ativo: true,
    criado_em: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  const { error: lookupErr } = await sb.from('member_lookup').upsert({
    email_key: emailKey,
    email: emailKey,
    boss_uid: ownerUid,
    ativo: true,
  });
  if (lookupErr) return { ok: false, error: lookupErr.message };
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
