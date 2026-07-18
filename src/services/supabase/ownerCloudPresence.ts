import { getSupabase } from '../../config/supabase';

const PRESENCE_TABLES = ['cadastros', 'sessoes', 'aplicadores', 'team_e2e_meta'] as const;

/**
 * Verifica se o UID já possui banco de dados na nuvem (qualquer linha própria).
 * Usado para NÃO exibir os termos de criação de banco para contas existentes.
 * Em caso de erro/offline retorna false (o aceite local ainda evita repetição).
 */
export async function ownerHasExistingCloudData(ownerUid: string): Promise<boolean> {
  const uid = ownerUid.trim();
  if (!uid) return false;
  const sb = getSupabase();
  if (!sb) return false;

  for (const table of PRESENCE_TABLES) {
    try {
      const { count, error } = await sb
        .from(table)
        .select('owner_uid', { count: 'exact', head: true })
        .eq('owner_uid', uid)
        .limit(1);
      if (!error && (count ?? 0) > 0) return true;
    } catch {
      // tabela inacessível/offline — tenta a próxima
    }
  }
  return false;
}
