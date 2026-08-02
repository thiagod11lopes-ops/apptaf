/**
 * Gate de acesso: só o e-mail chefe canônico, e-mails autorizados
 * ou contas que já possuem banco na nuvem entram.
 */
import { getSupabase } from '../../config/supabase';
import {
  isAllowedAuthEmail,
  isValidAuthEmail,
  normalizeAuthEmail,
} from '../../utils/normalizeAuthEmail';
import { isCloudOwnerUid } from '../../utils/cloudOwnerUid';
import { resolveMemberAccess, type MemberAccess } from './authorizedEmailsCloud';
import { ownerHasExistingCloudData } from './ownerCloudPresence';

export const SYSTEM_ACCESS_BLOCKED_MESSAGE =
  'Sistema Bloqueado. Email não cadastrado pelo administrador';

/** Aviso no fluxo Entrar: e-mail ainda não cadastrado / não autorizado. */
export const SYSTEM_EMAIL_UNREGISTERED_MESSAGE =
  'Email não Cadastrado, clique em criar conta';

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

function ownBankAccess(loginUid: string): MemberAccess {
  return { dataOwnerUid: loginUid, isAuthorizedMember: false };
}

export type EmailAccessProbe = 'incomplete' | 'allowed' | 'blocked';

/**
 * Checagem de e-mail sem login (usada no clique Entrar / Criar conta).
 * incomplete = e-mail incompleto ou sem como decidir (offline / RPC ausente /
 * possível dono de banco com config canônica desatualizada — o login ainda valida).
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

  const canonical = await fetchCanonicalBossEmail();
  if (canonical && normalized === canonical) return 'allowed';

  try {
    const { data, error } = await sb.rpc('is_system_access_email', {
      p_email: normalized,
    });
    if (!error && data === true) return 'allowed';
    if (!error && data === false) {
      // RPC antiga pode negar o chefe se canonical_boss_email estiver errado.
      // Não bloqueia aqui: assertSystemAccessAllowed libera quem já tem banco.
      return 'incomplete';
    }

    if (error && /could not find|schema cache|404/i.test(error.message)) {
      // Sem RPC: não bloqueia no digitar (login ainda valida).
      return 'incomplete';
    }
  } catch {
    return 'incomplete';
  }

  return 'incomplete';
}

/**
 * Após autenticar no Auth: autoriza chefe canônico, membro autorizado
 * ou conta que já possui banco na nuvem.
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
    return ownBankAccess(loginUid);
  }

  const canonical = await fetchCanonicalBossEmail();
  const emailKey = email?.trim() ? normalizeAuthEmail(email) : '';
  if (canonical && emailKey && emailKey === canonical) {
    return ownBankAccess(loginUid);
  }

  // Já criou/possui banco na nuvem → não bloqueia (mesmo se config canônica divergir).
  if (isCloudOwnerUid(loginUid) && (await ownerHasExistingCloudData(loginUid))) {
    return ownBankAccess(loginUid);
  }

  throw new SystemAccessBlockedError();
}
