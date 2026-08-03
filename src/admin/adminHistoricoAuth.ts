import { getSupabase, isSupabaseConfigured } from '../config/supabase';
import {
  signInWithEmailPassword,
  signOutCloud,
} from '../services/supabase/emailAuth';
import {
  fetchCanonicalBossEmail,
} from '../services/supabase/systemAccessGate';
import { normalizeAuthEmail } from '../utils/normalizeAuthEmail';

export type AdminHistoricoBossSession = {
  uid: string;
  email: string;
};

export type AdminHistoricoAccessResult =
  | { status: 'ok'; session: AdminHistoricoBossSession }
  | { status: 'no_supabase' }
  | { status: 'no_session' }
  | { status: 'not_boss' };

async function emailMatchesCanonicalBoss(email: string | null | undefined): Promise<boolean> {
  const emailKey = email?.trim() ? normalizeAuthEmail(email) : '';
  if (!emailKey) return false;
  const canonical = await fetchCanonicalBossEmail();
  return Boolean(canonical && emailKey === canonical);
}

async function isCurrentSessionCanonicalBoss(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { data, error } = await sb.rpc('is_canonical_boss');
    if (!error && data === true) return true;
  } catch {
    // RPC ausente — cai no app_config
  }
  const { data } = await sb.auth.getSession();
  return emailMatchesCanonicalBoss(data.session?.user?.email);
}

/** Sessão Supabase atual é do chefe canônico? */
export async function resolveAdminHistoricoAccess(): Promise<AdminHistoricoAccessResult> {
  if (!isSupabaseConfigured()) return { status: 'no_supabase' };
  const sb = getSupabase();
  if (!sb) return { status: 'no_supabase' };

  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return { status: 'no_session' };

  if (!(await isCurrentSessionCanonicalBoss())) {
    return { status: 'not_boss' };
  }

  const email = user.email ? normalizeAuthEmail(user.email) : '';
  if (!email) return { status: 'not_boss' };
  return { status: 'ok', session: { uid: user.id, email } };
}

/**
 * Login do painel admin: só aceita o e-mail do chefe canônico.
 * Conta autorizada / outro e-mail → encerra a sessão e falha.
 */
export async function signInAdminHistoricoBoss(
  email: string,
  password: string,
): Promise<AdminHistoricoBossSession> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não está configurado neste deploy.');
  }

  await signInWithEmailPassword(email, password);
  const access = await resolveAdminHistoricoAccess();
  if (access.status === 'ok') {
    return access.session;
  }

  await signOutCloud().catch(() => undefined);
  if (access.status === 'not_boss') {
    throw new Error('Apenas o e-mail do chefe pode abrir o painel Admin.');
  }
  throw new Error('Não foi possível validar o acesso do chefe. Tente novamente.');
}

export async function signOutAdminHistorico(): Promise<void> {
  await signOutCloud();
}
