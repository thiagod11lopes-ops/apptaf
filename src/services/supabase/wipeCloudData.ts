import { requireSupabase } from '../../config/supabase';
import { wipeOwnerTable } from './ownerDocs';
import { listMemberLoginUidsForBoss } from './authorizedEmailsCloud';

export type WipeCloudCounts = {
  cadastros: number;
  sessoes: number;
  aplicadores: number;
  cadastroRubricas: number;
  sessaoRubricas: number;
  preCadastros: number;
};

export type WipeCloudTeamResult = WipeCloudCounts & {
  memberAccountsWiped: number;
  teamWipeAt: number;
};

export type WipeCloudCollectionProgress = {
  collection: string;
  collectionLabel: string;
  deletedInCollection: number;
  totalInCollection: number;
  step: number;
  totalSteps: number;
};

export type WipeCloudProgressCallback = (update: WipeCloudCollectionProgress) => void;

const TABLES: Array<{ key: keyof WipeCloudCounts; label: string; table: string }> = [
  { key: 'cadastros', label: 'Cadastros na nuvem', table: 'cadastros' },
  { key: 'sessoes', label: 'Sessões de TAF na nuvem', table: 'sessoes' },
  { key: 'aplicadores', label: 'Aplicadores na nuvem', table: 'aplicadores' },
  { key: 'cadastroRubricas', label: 'Rubricas de cadastros', table: 'cadastro_rubricas' },
  { key: 'sessaoRubricas', label: 'Rubricas de sessões', table: 'sessao_rubricas' },
  { key: 'preCadastros', label: 'Pré-cadastros', table: 'pre_cadastros' },
];

export async function setTeamWipeMarker(ownerUid: string, wipedAt: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('team_wipe').upsert({
    owner_uid: ownerUid,
    wiped_at: wipedAt,
    wiped_at_server: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getTeamWipeMarker(
  ownerUid: string,
): Promise<{ wipedAt: number } | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('team_wipe')
    .select('wiped_at')
    .eq('owner_uid', ownerUid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { wipedAt: Number(data.wiped_at) || 0 };
}

export async function wipeCloudTeamDataFirestore(
  ownerUid: string,
  onProgress?: WipeCloudProgressCallback,
): Promise<WipeCloudTeamResult> {
  const counts: WipeCloudCounts = {
    cadastros: 0,
    sessoes: 0,
    aplicadores: 0,
    cadastroRubricas: 0,
    sessaoRubricas: 0,
    preCadastros: 0,
  };

  let step = 0;
  for (const item of TABLES) {
    step += 1;
    onProgress?.({
      collection: item.table,
      collectionLabel: item.label,
      deletedInCollection: 0,
      totalInCollection: 0,
      step,
      totalSteps: TABLES.length + 1,
    });
    await wipeOwnerTable(item.table, ownerUid);
    counts[item.key] = 1;
    onProgress?.({
      collection: item.table,
      collectionLabel: item.label,
      deletedInCollection: 1,
      totalInCollection: 1,
      step,
      totalSteps: TABLES.length + 1,
    });
  }

  await wipeOwnerTable('aplicador_senhas', ownerUid);

  const teamWipeAt = Date.now();
  await setTeamWipeMarker(ownerUid, teamWipeAt);

  const memberUids = await listMemberLoginUidsForBoss(ownerUid).catch(() => []);
  return {
    ...counts,
    memberAccountsWiped: memberUids.length,
    teamWipeAt,
  };
}
