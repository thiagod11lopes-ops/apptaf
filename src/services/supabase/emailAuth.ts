import { Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured, requireSupabase } from '../../config/supabase';
import { assertAllowedAuthEmail, normalizeAuthEmail } from '../../utils/normalizeAuthEmail';

export type AppAuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export function mapSupabaseUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): AppAuthUser {
  const meta = user.user_metadata ?? {};
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: (meta.full_name as string) || (meta.name as string) || null,
    photoURL: (meta.avatar_url as string) || (meta.picture as string) || null,
  };
}

/** @deprecated compat */
export function mapFirebaseUser(user: {
  uid?: string;
  id?: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  user_metadata?: Record<string, unknown>;
}): AppAuthUser {
  if (user.id) {
    return mapSupabaseUser(user as {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    });
  }
  return {
    uid: user.uid || '',
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
  };
}

export function canUseEmailAuth(): boolean {
  return isSupabaseConfigured();
}

export function getAuthRedirectUri(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const basePath = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
  return `${window.location.origin}${basePath}`;
}

function readAuthReturnParams(): URLSearchParams | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  const source = hash.includes('=') ? hash : window.location.search.replace(/^\?/, '');
  if (!source) return null;
  return new URLSearchParams(source);
}

export function isPasswordRecoveryCallback(): boolean {
  const params = readAuthReturnParams();
  return params?.get('type') === 'recovery';
}

/** Callback de recuperação de senha / confirmação de e-mail (tokens no hash). */
export function hasPendingAuthCallback(): boolean {
  const params = readAuthReturnParams();
  if (!params) return false;
  const type = params.get('type');
  return (
    params.has('access_token') ||
    params.has('refresh_token') ||
    params.has('code') ||
    type === 'recovery' ||
    type === 'signup' ||
    params.has('error')
  );
}

/** @deprecated nome legado */
export function hasPendingGoogleOAuthReturn(): boolean {
  return hasPendingAuthCallback();
}

export function isFirebaseAuthRedirectReturn(): boolean {
  return hasPendingAuthCallback();
}

export function parseAuthErrorFromWindow(): string | null {
  const params = readAuthReturnParams();
  if (!params?.has('error')) return null;
  return params.get('error_description') || params.get('error') || 'Erro na autenticação.';
}

export function clearOAuthParamsFromWindow(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.hash && !url.search) return;
  url.hash = '';
  url.search = '';
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export function clearFirebaseAuthParamsFromWindow(): void {
  clearOAuthParamsFromWindow();
}

let lastRedirectAuthError: string | null = null;

export function rememberRedirectAuthError(message: string): void {
  lastRedirectAuthError = message;
}

export function consumeLastRedirectAuthError(): string | null {
  const msg = lastRedirectAuthError;
  lastRedirectAuthError = null;
  return msg;
}

export async function getCurrentAuthUid(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

export function getCurrentFirebaseUid(): string | null {
  return null;
}

function translateAuthError(message: string, context?: 'signin' | 'signup' | 'reset'): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return 'Confirme seu e-mail pelo link enviado antes de entrar. Verifique também a pasta de spam.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Este e-mail já possui conta. Use Entrar (não Criar conta) ou recupere a senha.';
  }
  if (m.includes('password should be') || m.includes('password is known')) {
    return 'A senha não atende aos requisitos. Use ao menos 6 caracteres.';
  }
  if (
    m.includes('rate limit') ||
    m.includes('too many') ||
    m.includes('over_email_send_rate_limit') ||
    m.includes('email rate limit')
  ) {
    if (context === 'signup' || m.includes('email') || m.includes('over_email')) {
      return (
        'Limite de e-mails de confirmação do Supabase atingido (vale para o projeto inteiro, ' +
        'não é bloqueio do e-mail autorizado). Aguarde cerca de 1 hora OU no painel Supabase: ' +
        'Authentication → Providers → Email → desative "Confirm email" e tente Criar conta de novo uma vez.'
      );
    }
    return (
      'Muitas tentativas de login (limite do Supabase). Aguarde alguns minutos e use Entrar. ' +
      'Não use Criar conta de novo se a conta já existe.'
    );
  }
  return message;
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<AppAuthUser> {
  const normalizedEmail = assertAllowedAuthEmail(email);
  const sb = requireSupabase();

  // Sessão já aberta para o mesmo e-mail: reutiliza (evita rate limit em retries de E2E).
  const { data: existing } = await sb.auth.getSession();
  const existingEmail = existing.session?.user?.email
    ? normalizeAuthEmail(existing.session.user.email)
    : null;
  if (existing.session?.user && existingEmail === normalizedEmail) {
    return mapSupabaseUser(existing.session.user);
  }

  const { data, error } = await sb.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) {
    const msg = error.message || '';
    if (/rate limit|too many/i.test(msg)) {
      const { data: again } = await sb.auth.getSession();
      const againEmail = again.session?.user?.email
        ? normalizeAuthEmail(again.session.user.email)
        : null;
      if (again.session?.user && againEmail === normalizedEmail) {
        return mapSupabaseUser(again.session.user);
      }
    }
    throw new Error(translateAuthError(msg, 'signin'));
  }
  if (!data.user) throw new Error('Login sem usuário.');
  return mapSupabaseUser(data.user);
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
): Promise<{ user: AppAuthUser | null; needsEmailConfirmation: boolean }> {
  const normalizedEmail = assertAllowedAuthEmail(email);
  const sb = requireSupabase();
  const redirectTo = getAuthRedirectUri();
  const { data, error } = await sb.auth.signUp({
    email: normalizedEmail,
    password,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });
  if (error) {
    const msg = error.message || '';
    // Conta já criada em tentativa anterior (confirmação pendente ou concluída).
    if (/already|registered|exists/i.test(msg)) {
      throw new Error(translateAuthError(msg, 'signup'));
    }
    throw new Error(translateAuthError(msg, 'signup'));
  }
  if (!data.user) throw new Error('Cadastro sem usuário.');

  // Supabase pode devolver user sem session quando "Confirm email" está ativo.
  // identities vazio = e-mail já cadastrado (anti-enumeration); trate como conta existente.
  const identities = (data.user as { identities?: unknown[] }).identities;
  if (Array.isArray(identities) && identities.length === 0) {
    throw new Error(
      'Este e-mail já possui conta (ou aguarda confirmação). Use Entrar ou verifique o e-mail de confirmação.',
    );
  }

  const needsEmailConfirmation = !data.session;
  return {
    user: mapSupabaseUser(data.user),
    needsEmailConfirmation,
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = assertAllowedAuthEmail(email);
  const sb = requireSupabase();
  const redirectTo = getAuthRedirectUri();
  const { error } = await sb.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: redirectTo || undefined,
  });
  if (error) throw new Error(translateAuthError(error.message, 'reset'));
}

export async function updateAccountPassword(newPassword: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signOutCloud(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

/** @deprecated */
export async function signOutFirebase(): Promise<void> {
  await signOutCloud();
}

/** No-op: login Google removido — sessão vem de e-mail/senha. */
export async function startFirebaseRedirectSignIn(): Promise<void> {
  // Mantido para imports legados (App.tsx).
}
