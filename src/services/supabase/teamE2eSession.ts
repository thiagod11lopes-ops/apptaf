import {
  deriveTeamKeyFromPassphrase,
  setActiveTeamKey,
  getActiveTeamKey,
} from './e2eCrypto';
import { fetchTeamE2eMeta, upsertTeamE2eMeta } from './teamE2eCloud';

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
  // extractable: true — preciso exportar JWK para sessionStorage entre reloads
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

/** Restaura chave da sessão do navegador (recarregar página sem pedir senha de novo). */
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

/**
 * Ativa criptografia E2E com a senha de login.
 * Chefe: cria chave de equipe na primeira vez; membros usam a mesma senha de criptografia do chefe.
 */
export async function activateE2eFromLoginPassword(
  ownerUid: string,
  password: string,
): Promise<void> {
  if (!ownerUid.trim() || !password) {
    clearE2eSession();
    return;
  }

  let meta = await fetchTeamE2eMeta(ownerUid);
  if (!meta) {
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

  const teamKey = await unwrapTeamKeyRaw(meta.wrapped_key_b64, password, meta.salt_b64);
  setActiveTeamKey(teamKey);
  await persistSessionKey(ownerUid, teamKey);
}

export const E2E_KEY_REQUIRED = 'e2e_key_required';
export const E2E_ENCRYPTION_NOT_ACTIVATED = 'e2e_encryption_not_activated';

export const E2E_KEY_REQUIRED_MESSAGE =
  'Criptografia da equipe não está ativa nesta sessão. Saia da conta e entre novamente com e-mail e senha para desbloquear antes de sincronizar.';

export const E2E_ENCRYPTION_NOT_ACTIVATED_MESSAGE =
  'A criptografia da equipe ainda não foi ativada. Saia da conta e entre novamente com e-mail e senha (isso cria a chave na primeira vez).';

/**
 * Garante chave E2E antes de enviar dados à nuvem.
 * Nunca libera sync sem chave — evita texto plano na nuvem.
 */
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
