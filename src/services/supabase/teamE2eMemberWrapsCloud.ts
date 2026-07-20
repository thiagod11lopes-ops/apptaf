import { requireSupabase } from '../../config/supabase';
import { normalizeAuthEmail } from '../../utils/normalizeAuthEmail';

export type TeamE2eMemberWrapRow = {
  owner_uid: string;
  email_key: string;
  salt_b64: string;
  wrapped_key_b64: string;
  key_version: number;
};

export async function fetchTeamE2eMemberWrap(
  ownerUid: string,
  email: string,
): Promise<TeamE2eMemberWrapRow | null> {
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);
  const { data, error } = await sb
    .from('team_e2e_member_wraps')
    .select('owner_uid, email_key, salt_b64, wrapped_key_b64, key_version')
    .eq('owner_uid', ownerUid)
    .eq('email_key', emailKey)
    .maybeSingle();
  if (error) {
    // Tabela ainda não criada no projeto — trata como ausência.
    if (/relation|does not exist|schema cache|404/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as TeamE2eMemberWrapRow | null) ?? null;
}

export async function upsertTeamE2eMemberWrap(
  ownerUid: string,
  email: string,
  saltB64: string,
  wrappedKeyB64: string,
  keyVersion = 1,
): Promise<void> {
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);
  const { error } = await sb.from('team_e2e_member_wraps').upsert({
    owner_uid: ownerUid,
    email_key: emailKey,
    salt_b64: saltB64,
    wrapped_key_b64: wrappedKeyB64,
    key_version: keyVersion,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteTeamE2eMemberWrap(
  ownerUid: string,
  email: string,
): Promise<void> {
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);
  const { error } = await sb
    .from('team_e2e_member_wraps')
    .delete()
    .eq('owner_uid', ownerUid)
    .eq('email_key', emailKey);
  if (error && !/relation|does not exist|schema cache|404/i.test(error.message)) {
    throw new Error(error.message);
  }
}
