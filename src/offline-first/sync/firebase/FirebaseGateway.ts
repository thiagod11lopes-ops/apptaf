/**
 * ÚNICO ponto de acesso à nuvem para o Sync Engine (Supabase).
 */
import { getSupabase } from '../../../config/supabase';
import { SYNC_UPDATE_BLOCKED } from '../syncAuthMessages';

export {
  getAllCadastrosFirestoreLight,
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
  purgeCadastroFirestore,
} from '../../../services/supabase/cadastrosCloud';

export {
  getAllSessoesFirestoreLight,
  addSessaoFirestore,
  updateSessaoFirestore,
  deleteSessaoFirestore,
  purgeSessaoFirestore,
} from '../../../services/supabase/sessoesCloud';

export {
  getAllAplicadoresFirestore,
  addAplicadorFirestore,
  deleteAplicadorFirestore,
  purgeAplicadorFirestore,
} from '../../../services/supabase/aplicadoresCloud';

export {
  getAllPreCadastrosFirestore,
  addPreCadastroFirestore,
  deletePreCadastroFirestore,
} from '../../../services/supabase/preCadastrosCloud';

export {
  resolveMemberAccess,
  registerAuthorizedMemberLogin,
  listAuthorizedEmails,
  addAuthorizedEmail,
  removeAuthorizedEmail,
  type AuthorizedEmailEntry,
  type MemberAccess,
} from '../../../services/supabase/authorizedEmailsCloud';

export { getTeamWipeMarker } from '../../../services/supabase/wipeCloudData';

export { wipeCloudTeamDataFirestore as wipeAllCloudDataForOwner } from '../../../services/supabase/wipeCloudData';

export type FirestoreProbeResult = {
  ok: boolean;
  reason?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function probeFirestoreConnectivityDetailed(
  ownerUid?: string,
): Promise<FirestoreProbeResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'Supabase indisponível.' };

  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { ok: false, reason: 'Sessão não encontrada. Entre com e-mail e senha.' };

  const targetUid = ownerUid?.trim() || user.id;
  let lastReason = 'Não foi possível conectar ao Supabase.';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { error } = await sb
        .from('cadastros')
        .select('id')
        .eq('owner_uid', targetUid)
        .limit(1);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      lastReason = msg.includes('JWT') || msg.includes('auth')
        ? 'Token de autenticação expirado. Entre novamente com Google.'
        : msg.includes('permission') || msg.includes('RLS') || msg.includes('policy')
          ? targetUid !== user.id
            ? 'Permissão negada na nuvem. Confirme que entrou com o e-mail autorizado pelo chefe.'
            : 'Permissão negada na nuvem. Verifique se sua conta está autorizada e se as policies RLS foram aplicadas.'
          : msg || lastReason;
      await sleep(300 * (attempt + 1));
    }
  }
  return { ok: false, reason: lastReason };
}

export async function probeFirestoreConnectivity(ownerUid?: string): Promise<boolean> {
  const result = await probeFirestoreConnectivityDetailed(ownerUid);
  return result.ok;
}

/** Estima horário do servidor (UTC ms) via round-trip leve ao Supabase. */
export async function estimateServerTimeMs(): Promise<number | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const before = Date.now();
    await sb.from('cadastros').select('id').limit(1);
    const after = Date.now();
    return Math.round((before + after) / 2);
  } catch {
    return null;
  }
}

export function cloudUnavailableMessage(): string {
  return SYNC_UPDATE_BLOCKED;
}
