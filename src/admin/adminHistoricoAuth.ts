import { getSupabase, isSupabaseConfigured } from '../config/supabase';
import { getFirebaseAuth } from '../config/firebase';
import {
  signInWithEmailPassword,
  signOutCloud,
} from '../services/supabase/emailAuth';
import {
  fetchCanonicalBossEmail,
} from '../services/supabase/systemAccessGate';
import { normalizeAuthEmail } from '../utils/normalizeAuthEmail';
import { hydrateAppStorageFromIndexedDb } from '../offline-first/db/appMeta';
import { setAuthUidState } from '../services/firebase/authUid';
import {
  activateE2eFromLoginPassword,
  ensureE2eUnlockedForSession,
  clearE2eSession,
} from '../services/supabase/teamE2eSession';
import { getActiveTeamKey } from '../services/supabase/e2eCrypto';
import {
  syncManager,
  SYNC_AUTH_REQUIRED,
} from '../offline-first/sync/SyncManager';
import {
  setCloudLinkEnabled,
} from '../offline-first/sync/cloudLinkPreference';

export type AdminHistoricoBossSession = {
  uid: string;
  email: string;
};

export type AdminHistoricoAccessResult =
  | { status: 'ok'; session: AdminHistoricoBossSession }
  | { status: 'no_supabase' }
  | { status: 'no_session' }
  | { status: 'not_boss' };

export const ADMIN_E2E_NEEDS_PASSWORD = 'ADMIN_E2E_NEEDS_PASSWORD';

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
 * Desbloqueia E2E, liga a nuvem e espelha cadastros (nuvem ↔ local)
 * para o painel Admin poder ler/gravar a Planilha na nuvem.
 */
export async function prepareAdminHistoricoCloudSession(
  session: AdminHistoricoBossSession,
  password?: string,
): Promise<void> {
  await hydrateAppStorageFromIndexedDb();
  setAuthUidState(session.uid, session.uid, true);

  if (password) {
    await activateE2eFromLoginPassword(session.uid, password, { createIfMissing: true });
  } else {
    const restored = await ensureE2eUnlockedForSession(session.uid, session.email);
    if (!restored || !getActiveTeamKey()) {
      const err = new Error(ADMIN_E2E_NEEDS_PASSWORD);
      err.name = ADMIN_E2E_NEEDS_PASSWORD;
      throw err;
    }
  }

  if (!getActiveTeamKey()) {
    throw new Error(
      'Não foi possível desbloquear a criptografia do banco. Confira a senha do chefe.',
    );
  }

  syncManager.setAuthAvailable(true);
  await syncManager.bindSession(session.uid);
  setCloudLinkEnabled(true);

  const ensureAuth = async () => {
    if (!getFirebaseAuth()?.currentUser) {
      return { ok: false as const, error: SYNC_AUTH_REQUIRED };
    }
    return { ok: true as const };
  };

  const sync = await syncManager.startSyncFromToggle(ensureAuth);
  if (!sync.ok && sync.error && sync.error !== 'sync_in_progress') {
    console.warn('[admin-historico] sync inicial:', sync.error);
  }
}

/**
 * Login do painel admin: só aceita o e-mail do chefe canônico.
 * Também desbloqueia a criptografia e sincroniza a Planilha com a nuvem.
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
  if (access.status !== 'ok') {
    await signOutCloud().catch(() => undefined);
    if (access.status === 'not_boss') {
      throw new Error('Apenas o e-mail do chefe pode abrir o painel Admin.');
    }
    throw new Error('Não foi possível validar o acesso do chefe. Tente novamente.');
  }

  try {
    await prepareAdminHistoricoCloudSession(access.session, password);
  } catch (error) {
    clearE2eSession();
    await signOutCloud().catch(() => undefined);
    throw error;
  }

  return access.session;
}

/** Envia pendências da Planilha (cadastros) para a nuvem. */
export async function flushAdminHistoricoCadastrosToCloud(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!getFirebaseAuth()?.currentUser) {
    return { ok: false, error: 'Sessão expirada. Entre de novo com o e-mail do chefe.' };
  }
  if (!getActiveTeamKey()) {
    return {
      ok: false,
      error: 'Criptografia do banco não está ativa. Saia e entre de novo com a senha do chefe.',
    };
  }

  setCloudLinkEnabled(true);
  syncManager.setAuthAvailable(true);

  const ensureAuth = async () => {
    if (!getFirebaseAuth()?.currentUser) {
      return { ok: false as const, error: SYNC_AUTH_REQUIRED };
    }
    return { ok: true as const };
  };

  const result = await syncManager.startSyncFromToggle(ensureAuth);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error || 'Não foi possível enviar as alterações para a nuvem.',
    };
  }
  return { ok: true };
}

export async function signOutAdminHistorico(): Promise<void> {
  setCloudLinkEnabled(false);
  clearE2eSession();
  await signOutCloud();
}
