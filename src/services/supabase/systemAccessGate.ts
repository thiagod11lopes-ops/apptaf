/**
 * Gate de acesso: só o e-mail chefe canônico ou e-mails autorizados entram.
 */
import { getSupabase } from '../../config/supabase';
import {
  isAllowedAuthEmail,
  isValidAuthEmail,
  normalizeAuthEmail,
} from '../../utils/normalizeAuthEmail';
import { isCloudOwnerUid } from '../../utils/cloudOwnerUid';
import { resolveMemberAccess, type MemberAccess } from './authorizedEmailsCloud';

export const SYSTEM_ACCESS_BLOCKED_MESSAGE =
  'Sistema Bloqueado. Email não cadastrado pelo administrador';

export class SystemAccessBlockedError extends Error {
  constructor(message = SYSTEM_ACCESS_BLOCKED_MESSAGE) {
    super(message);
    this.name = 'SystemAccessBlockedError';
  }
}

export function isSystemAccessBlockedError(error: unknown): boolean {
  if (error instanceof SystemAccessBlockedError) return true;
  return error instanceof Error && error.message === SYSTEM_ACCESS_BLOCKED_MESSAGE;
}

export async function fetchCanonicalBossEmail(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('app_config')
      .select('value')
      .eq('key', 'canonical_boss_email')
      .maybeSingle();
    if (error || typeof data?.value !== 'string' || !data.value.trim()) return null;
    return normalizeAuthEmail(data.value);
  } catch {
    return null;
  }
}

async function isCurrentUserCanonicalBoss(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { data, error } = await sb.rpc('is_canonical_boss');
    if (!error && data === true) return true;
  } catch {
    // RPC ausente — cai no app_config
  }
  return false;
}

export type EmailAccessProbe = 'incomplete' | 'allowed' | 'blocked';

/**
 * Pré-checagem no campo de e-mail (sem login).
 * incomplete = ainda digitando / não dá para decidir.
 */
export async function probeEmailSystemAccess(email: string): Promise<EmailAccessProbe> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized.includes('@') || !isValidAuthEmail(normalized)) {
    return 'incomplete';
  }
  if (!isAllowedAuthEmail(normalized)) {
    return 'blocked';
  }

  const sb = getSupabase();
  if (!sb) return 'incomplete';

  try {
    const { data, error } = await sb.rpc('is_system_access_email', {
      p_email: normalized,
    });
    if (!error && data === true) return 'allowed';
    if (!error && data === false) return 'blocked';

    if (error && /could not find|schema cache|404/i.test(error.message)) {
      const canonical = await fetchCanonicalBossEmail();
      if (canonical && normalized === canonical) return 'allowed';
      // Sem RPC: não bloqueia no digitar (login ainda valida).
      return 'incomplete';
    }
  } catch {
    const canonical = await fetchCanonicalBossEmail();
    if (canonical && normalized === canonical) return 'allowed';
    return 'incomplete';
  }

  return 'blocked';
}

/**
 * Após autenticar no Auth: autoriza chefe canônico ou membro autorizado.
 * Caso contrário lança SystemAccessBlockedError.
 */
export async function assertSystemAccessAllowed(
  loginUid: string,
  email: string | null | undefined,
): Promise<MemberAccess> {
  const access = await resolveMemberAccess(loginUid, email);
  const isMember =
    access.isAuthorizedMember &&
    isCloudOwnerUid(access.dataOwnerUid) &&
    access.dataOwnerUid !== loginUid;
  if (isMember) return access;

  if (await isCurrentUserCanonicalBoss()) {
    return { dataOwnerUid: loginUid, isAuthorizedMember: false };
  }

  const canonical = await fetchCanonicalBossEmail();
  const emailKey = email?.trim() ? normalizeAuthEmail(email) : '';
  if (canonical && emailKey && emailKey === canonical) {
    return { dataOwnerUid: loginUid, isAuthorizedMember: false };
  }

  throw new SystemAccessBlockedError();
}
