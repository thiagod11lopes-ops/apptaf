import { requireSupabase } from '../../config/supabase';
import { normalizeAuthEmail } from '../../utils/normalizeAuthEmail';

export type TeamE2eMemberWrapRow = {
  owner_uid: string;
  email_key: string;
  salt_b64: string;
  wrapped_key_b64: string;
  key_version: number;
  /** Segredo gerado na autorização (chefe); membro desbloqueia sem senha do chefe. */
  access_secret_b64?: string | null;
};

export async function fetchTeamE2eMemberWrap(
  ownerUid: string,
  email: string,
): Promise<TeamE2eMemberWrapRow | null> {
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);
  const { data, error } = await sb
    .from('team_e2e_member_wraps')
    .select('owner_uid, email_key, salt_b64, wrapped_key_b64, key_version, access_secret_b64')
    .eq('owner_uid', ownerUid)
    .eq('email_key', emailKey)
    .maybeSingle();
  if (error) {
    // Coluna access_secret_b64 ainda não existe — tenta sem ela.
    if (/access_secret_b64|column/i.test(error.message)) {
      const retry = await sb
        .from('team_e2e_member_wraps')
        .select('owner_uid, email_key, salt_b64, wrapped_key_b64, key_version')
        .eq('owner_uid', ownerUid)
        .eq('email_key', emailKey)
        .maybeSingle();
      if (retry.error) {
        if (/relation|does not exist|schema cache|404/i.test(retry.error.message)) return null;
        throw new Error(retry.error.message);
      }
      return (retry.data as TeamE2eMemberWrapRow | null) ?? null;
    }
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
  accessSecretB64?: string | null,
): Promise<void> {
  const sb = requireSupabase();
  const emailKey = normalizeAuthEmail(email);
  const payload: Record<string, unknown> = {
    owner_uid: ownerUid,
    email_key: emailKey,
    salt_b64: saltB64,
    wrapped_key_b64: wrappedKeyB64,
    key_version: keyVersion,
    updated_at: new Date().toISOString(),
  };
  if (accessSecretB64 !== undefined) {
    payload.access_secret_b64 = accessSecretB64;
  }
  const { error } = await sb.from('team_e2e_member_wraps').upsert(payload);
  if (error) {
    if (/access_secret_b64|column/i.test(error.message) && accessSecretB64) {
      // Schema antigo: grava sem a coluna (membro ainda precisará bootstrap).
      const { error: e2 } = await sb.from('team_e2e_member_wraps').upsert({
        owner_uid: ownerUid,
        email_key: emailKey,
        salt_b64: saltB64,
        wrapped_key_b64: wrappedKeyB64,
        key_version: keyVersion,
        updated_at: new Date().toISOString(),
      });
      if (e2) throw new Error(e2.message);
      return;
    }
    throw new Error(error.message);
  }
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
