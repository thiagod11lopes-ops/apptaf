import { Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured, requireSupabase } from '../../config/supabase';
import { assertAllowedAuthEmail } from '../../utils/normalizeAuthEmail';

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

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Este e-mail já possui conta. Faça login ou recupere a senha.';
  }
  if (m.includes('password should be') || m.includes('password is known')) {
    return 'A senha não atende aos requisitos. Use ao menos 6 caracteres.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Muitas tentativas. Aguarde um momento e tente de novo.';
  }
  return message;
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<AppAuthUser> {
  const normalizedEmail = assertAllowedAuthEmail(email);
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw new Error(translateAuthError(error.message));
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
  if (error) throw new Error(translateAuthError(error.message));
  if (!data.user) throw new Error('Cadastro sem usuário.');
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
  if (error) throw new Error(translateAuthError(error.message));
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
