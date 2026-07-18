import { requireSupabase } from '../../config/supabase';

export type TeamE2eMetaRow = {
  owner_uid: string;
  salt_b64: string;
  wrapped_key_b64: string;
  key_version: number;
};

export async function fetchTeamE2eMeta(ownerUid: string): Promise<TeamE2eMetaRow | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('team_e2e_meta')
    .select('owner_uid, salt_b64, wrapped_key_b64, key_version')
    .eq('owner_uid', ownerUid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TeamE2eMetaRow | null) ?? null;
}

export async function upsertTeamE2eMeta(
  ownerUid: string,
  saltB64: string,
  wrappedKeyB64: string,
  keyVersion = 1,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('team_e2e_meta').upsert({
    owner_uid: ownerUid,
    salt_b64: saltB64,
    wrapped_key_b64: wrappedKeyB64,
    key_version: keyVersion,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
