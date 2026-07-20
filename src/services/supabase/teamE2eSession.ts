import {
  deriveTeamKeyFromPassphrase,
  setActiveTeamKey,
  getActiveTeamKey,
} from './e2eCrypto';
import { fetchTeamE2eMeta, upsertTeamE2eMeta } from './teamE2eCloud';
import {
  deleteTeamE2eMemberWrap,
  fetchTeamE2eMemberWrap,
  upsertTeamE2eMemberWrap,
} from './teamE2eMemberWrapsCloud';
import { normalizeAuthEmail } from '../../utils/normalizeAuthEmail';

const SESSION_STORAGE_KEY = 'taf:e2e:teamKey';

type StoredE2eSession = {
  ownerUid: string;
  keyJwk: JsonWebKey;
};

function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let s = '';
    bytes.forEach((b) => {
      s += String.fromCharCode(b);
    });
    return btoa(s);
  }
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

type WrappedTeamKey = { iv: string; ct: string };

async function wrapTeamKeyRaw(
  teamKey: CryptoKey,
  password: string,
  saltB64: string,
): Promise<string> {
  const kek = await deriveTeamKeyFromPassphrase(password, saltB64);
  const raw = await crypto.subtle.exportKey('raw', teamKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    kek,
    raw,
  );
  const payload: WrappedTeamKey = {
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct)),
  };
  return JSON.stringify(payload);
}

async function unwrapTeamKeyRaw(
  wrappedJson: string,
  password: string,
  saltB64: string,
): Promise<CryptoKey> {
  const payload = JSON.parse(wrappedJson) as WrappedTeamKey;
  const kek = await deriveTeamKeyFromPassphrase(password, saltB64);
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) as BufferSource },
    kek,
    fromBase64(payload.ct) as BufferSource,
  );
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function persistSessionKey(ownerUid: string, key: CryptoKey): Promise<void> {
  if (typeof sessionStorage === 'undefined') return;
  const keyJwk = await crypto.subtle.exportKey('jwk', key);
  const stored: StoredE2eSession = { ownerUid, keyJwk };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
}

export function clearE2eSession(): void {
  setActiveTeamKey(null);
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export async function restoreE2eFromSessionStorage(ownerUid: string): Promise<boolean> {
  if (getActiveTeamKey()) return true;
  if (typeof sessionStorage === 'undefined') return false;
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return false;
  try {
    const stored = JSON.parse(raw) as StoredE2eSession;
    if (stored.ownerUid !== ownerUid || !stored.keyJwk) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      stored.keyJwk,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    setActiveTeamKey(key);
    return true;
  } catch {
    return false;
  }
}

async function persistMemberWrap(
  ownerUid: string,
  email: string,
  teamKey: CryptoKey,
  passphrase: string,
  keyVersion = 1,
  accessSecretB64?: string | null,
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = toBase64(salt);
  const wrapped = await wrapTeamKeyRaw(teamKey, passphrase, saltB64);
  await upsertTeamE2eMemberWrap(
    ownerUid,
    email,
    saltB64,
    wrapped,
    keyVersion,
    accessSecretB64 === undefined ? undefined : accessSecretB64,
  );
}

/**
 * Chefe com DEK desbloqueada: cria/atualiza acesso automático do e-mail autorizado.
 * O membro desbloqueia só com Auth (lê access_secret_b64 via RLS).
 */
export async function provisionAuthorizedMemberE2eAccess(
  bossUid: string,
  email: string,
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  if (!bossUid.trim() || !email.trim()) {
    return { ok: false, error: 'owner/email inválidos' };
  }

  let teamKey = getActiveTeamKey();
  if (!teamKey) {
    await restoreE2eFromSessionStorage(bossUid);
    teamKey = getActiveTeamKey();
  }
  if (!teamKey) {
    return {
      ok: false,
      skipped: 'dek_locked',
      error:
        'Criptografia bloqueada. Entre com a senha (escudo verde) e sincronize para liberar o acesso do membro.',
    };
  }

  const emailKey = normalizeAuthEmail(email);
  const existing = await fetchTeamE2eMemberWrap(bossUid, emailKey);
  if (existing?.access_secret_b64?.trim()) {
    // Já tem desbloqueio automático — revalida unwrap; se ok, mantém.
    try {
      await unwrapTeamKeyRaw(
        existing.wrapped_key_b64,
        existing.access_secret_b64,
        existing.salt_b64,
      );
      return { ok: true };
    } catch {
      /* regenera abaixo */
    }
  }

  const meta = await fetchTeamE2eMeta(bossUid);
  const keyVersion = Math.max(1, meta?.key_version ?? existing?.key_version ?? 1);
  const accessSecret = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  try {
    await persistMemberWrap(bossUid, emailKey, teamKey, accessSecret, keyVersion, accessSecret);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Garante wrap automático para todos os e-mails autorizados locais (chefe + DEK ativa). */
export async function provisionE2eAccessForAllAuthorizedEmails(
  bossUid: string,
  emails: string[],
): Promise<string[]> {
  const errors: string[] = [];
  for (const email of emails) {
    const result = await provisionAuthorizedMemberE2eAccess(bossUid, email);
    if (!result.ok && result.skipped !== 'dek_locked') {
      errors.push(`${email}: ${result.error ?? 'falha'}`);
    }
  }
  return errors;
}

/**
 * Ativa criptografia E2E com a senha de login.
 * Chefe: cria chave de equipe na primeira vez.
 */
export async function activateE2eFromLoginPassword(
  ownerUid: string,
  password: string,
  options?: { createIfMissing?: boolean },
): Promise<void> {
  if (!ownerUid.trim() || !password) {
    clearE2eSession();
    return;
  }

  const createIfMissing = options?.createIfMissing !== false;

  let meta = await fetchTeamE2eMeta(ownerUid);
  if (!meta) {
    if (!createIfMissing) {
      throw new Error(
        'A criptografia do banco do chefe ainda não foi ativada. Peça ao chefe para entrar com a senha dele e sincronizar uma vez.',
      );
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = toBase64(salt);
    const teamKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const wrapped = await wrapTeamKeyRaw(teamKey, password, saltB64);
    await upsertTeamE2eMeta(ownerUid, saltB64, wrapped);
    meta = { owner_uid: ownerUid, salt_b64: saltB64, wrapped_key_b64: wrapped, key_version: 1 };
  }

  try {
    const teamKey = await unwrapTeamKeyRaw(meta.wrapped_key_b64, password, meta.salt_b64);
    setActiveTeamKey(teamKey);
    await persistSessionKey(ownerUid, teamKey);
  } catch {
    throw new Error(
      'Não foi possível desbloquear a criptografia do banco. Confira a senha e tente de novo.',
    );
  }
}

export const E2E_MEMBER_NEEDS_BOOTSTRAP = 'e2e_member_needs_bootstrap';
export const E2E_MEMBER_WRAP_MISSING = 'e2e_member_wrap_missing';

export const E2E_MEMBER_NEEDS_BOOTSTRAP_MESSAGE =
  'Na primeira entrada neste banco, informe também a senha de criptografia do chefe (campo extra). Depois o app guarda o acesso com a sua senha.';

export const E2E_MEMBER_WRAP_MISSING_MESSAGE =
  'Seu e-mail está autorizado, mas o acesso ao banco ainda não foi liberado na nuvem. Peça ao chefe para entrar (escudo verde) e sincronizar — ou autorizar seu e-mail de novo.';

/**
 * Membro autorizado: desbloqueia a DEK do chefe.
 * Preferência: access_secret gravado na autorização (sem senha do chefe).
 * Fallbacks: wrap com senha do membro; bootstrap com senha do chefe (legado).
 */
export async function activateE2eForAuthorizedMember(
  bossUid: string,
  memberEmail: string,
  memberPassword?: string,
  options?: { bootstrapBossPassword?: string },
): Promise<void> {
  if (!bossUid.trim() || !memberEmail.trim()) {
    clearE2eSession();
    throw new Error('Dados insuficientes para desbloquear a criptografia do banco do chefe.');
  }

  const emailKey = normalizeAuthEmail(memberEmail);
  const memberWrap = await fetchTeamE2eMemberWrap(bossUid, emailKey);

  // 1) Desbloqueio automático (autorização pelo chefe).
  if (memberWrap?.access_secret_b64?.trim()) {
    try {
      const teamKey = await unwrapTeamKeyRaw(
        memberWrap.wrapped_key_b64,
        memberWrap.access_secret_b64,
        memberWrap.salt_b64,
      );
      setActiveTeamKey(teamKey);
      await persistSessionKey(bossUid, teamKey);
      return;
    } catch {
      console.warn('[e2e] access_secret inválido; tentando fallbacks');
    }
  }

  // 2) Wrap legado com senha do membro.
  if (memberWrap && memberPassword) {
    try {
      const teamKey = await unwrapTeamKeyRaw(
        memberWrap.wrapped_key_b64,
        memberPassword,
        memberWrap.salt_b64,
      );
      setActiveTeamKey(teamKey);
      await persistSessionKey(bossUid, teamKey);
      return;
    } catch {
      /* continua */
    }
  }

  const meta = await fetchTeamE2eMeta(bossUid);
  if (!meta) {
    throw new Error(
      'A criptografia do banco do chefe ainda não foi ativada. Peça ao chefe para entrar e sincronizar uma vez.',
    );
  }

  // 3) Bootstrap legado (senha do chefe uma vez) ou senha do membro = senha do chefe.
  const bootstrap = options?.bootstrapBossPassword?.trim() || '';
  const candidates = [memberPassword, bootstrap].filter(
    (p, i, arr): p is string => Boolean(p && p.length > 0 && arr.indexOf(p) === i),
  );

  let teamKey: CryptoKey | null = null;
  for (const candidate of candidates) {
    try {
      teamKey = await unwrapTeamKeyRaw(meta.wrapped_key_b64, candidate, meta.salt_b64);
      break;
    } catch {
      /* tenta próximo */
    }
  }

  if (!teamKey) {
    if (!memberWrap) {
      const err = new Error(E2E_MEMBER_WRAP_MISSING_MESSAGE);
      (err as Error & { code?: string }).code = E2E_MEMBER_WRAP_MISSING;
      throw err;
    }
    if (!bootstrap) {
      const err = new Error(E2E_MEMBER_WRAP_MISSING_MESSAGE);
      (err as Error & { code?: string }).code = E2E_MEMBER_WRAP_MISSING;
      throw err;
    }
    throw new Error(
      'Não foi possível desbloquear com a senha informada. Confira a senha de criptografia do chefe.',
    );
  }

  setActiveTeamKey(teamKey);
  await persistSessionKey(bossUid, teamKey);
  // Preferência: gravar acesso automático daqui pra frente.
  try {
    const accessSecret = toBase64(crypto.getRandomValues(new Uint8Array(32)));
    await persistMemberWrap(
      bossUid,
      emailKey,
      teamKey,
      accessSecret,
      meta.key_version ?? 1,
      accessSecret,
    );
  } catch (error) {
    console.warn('[e2e] falha ao gravar wrap automático do membro:', error);
    if (memberPassword) {
      try {
        await persistMemberWrap(bossUid, emailKey, teamKey, memberPassword, meta.key_version ?? 1);
      } catch (e2) {
        console.warn('[e2e] falha ao gravar wrap por senha do membro:', e2);
      }
    }
  }
}

/** Reembrulha o wrap do membro com a nova senha (DEK já desbloqueada). */
export async function rewrapMemberE2eWithNewPassword(
  bossUid: string,
  memberEmail: string,
  newPassword: string,
): Promise<void> {
  if (!bossUid.trim() || !memberEmail.trim() || !newPassword) return;
  const teamKey = await ensureTeamKeyUnlocked(bossUid);
  const existing = await fetchTeamE2eMemberWrap(bossUid, memberEmail);
  // Acesso automático: não depende da senha do membro — só regenera se não houver secret.
  if (existing?.access_secret_b64?.trim()) {
    return;
  }
  const nextVersion = Math.max(1, (existing?.key_version ?? 0) + 1);
  await persistMemberWrap(bossUid, memberEmail, teamKey, newPassword, nextVersion);
}

export async function removeMemberE2eWrap(bossUid: string, memberEmail: string): Promise<void> {
  await deleteTeamE2eMemberWrap(bossUid, memberEmail);
}

export const E2E_KEY_REQUIRED = 'e2e_key_required';
export const E2E_ENCRYPTION_NOT_ACTIVATED = 'e2e_encryption_not_activated';
export const E2E_REWRAP_NEEDS_ACTIVE_KEY = 'e2e_rewrap_needs_active_key';

export const E2E_KEY_REQUIRED_MESSAGE =
  'Criptografia da equipe não está ativa nesta sessão. Saia da conta e entre novamente com e-mail e senha para desbloquear antes de sincronizar.';

export const E2E_ENCRYPTION_NOT_ACTIVATED_MESSAGE =
  'A criptografia da equipe ainda não foi ativada. Saia da conta e entre novamente com e-mail e senha (isso cria a chave na primeira vez).';

export const E2E_REWRAP_NEEDS_ACTIVE_KEY_MESSAGE =
  'Para trocar a senha sem perder a criptografia, a chave da equipe precisa estar desbloqueada (escudo verde). Use Conta → Trocar senha com a senha atual.';

export const E2E_RECOVERY_NEEDS_UNLOCKED_SESSION_MESSAGE =
  'Recuperação de senha: neste aparelho a criptografia não está desbloqueada. Abra o mesmo link no navegador/aparelho onde o escudo já estava verde (mesma sessão). Se lembrar da senha, entre normalmente e use Conta → Trocar senha.';

export async function ensureTeamKeyUnlocked(ownerUid: string): Promise<CryptoKey> {
  if (!ownerUid.trim()) {
    throw new Error(E2E_REWRAP_NEEDS_ACTIVE_KEY_MESSAGE);
  }
  let teamKey = getActiveTeamKey();
  if (!teamKey) {
    await restoreE2eFromSessionStorage(ownerUid);
    teamKey = getActiveTeamKey();
  }
  if (!teamKey) {
    throw new Error(E2E_REWRAP_NEEDS_ACTIVE_KEY_MESSAGE);
  }
  return teamKey;
}

export async function rewrapTeamKeyWithNewPassword(
  ownerUid: string,
  newPassword: string,
): Promise<void> {
  if (!ownerUid.trim() || !newPassword) {
    throw new Error('Owner e nova senha são obrigatórios para reproteger a criptografia.');
  }

  const teamKey = await ensureTeamKeyUnlocked(ownerUid);
  const meta = await fetchTeamE2eMeta(ownerUid);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = toBase64(salt);
  const wrapped = await wrapTeamKeyRaw(teamKey, newPassword, saltB64);
  const nextVersion = Math.max(1, (meta?.key_version ?? 0) + 1);
  await upsertTeamE2eMeta(ownerUid, saltB64, wrapped, nextVersion);
  setActiveTeamKey(teamKey);
  await persistSessionKey(ownerUid, teamKey);
}

export async function ensureE2eKeyForCloudSync(ownerUid: string): Promise<void> {
  if (!ownerUid.trim()) {
    throw new Error(E2E_ENCRYPTION_NOT_ACTIVATED_MESSAGE);
  }
  if (getActiveTeamKey()) return;

  await restoreE2eFromSessionStorage(ownerUid);
  if (getActiveTeamKey()) return;

  let meta: Awaited<ReturnType<typeof fetchTeamE2eMeta>> = null;
  try {
    meta = await fetchTeamE2eMeta(ownerUid);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${E2E_KEY_REQUIRED_MESSAGE} (não foi possível ler team_e2e_meta: ${detail})`,
    );
  }

  if (meta) {
    throw new Error(E2E_KEY_REQUIRED_MESSAGE);
  }
  throw new Error(E2E_ENCRYPTION_NOT_ACTIVATED_MESSAGE);
}
