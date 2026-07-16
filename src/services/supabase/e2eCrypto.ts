/**
 * Criptografia ponta a ponta (E2E) — etapa 3.
 *
 * Modelo: chave de equipe do chefe (AES-GCM).
 * - Dados sobem para o Supabase já cifrados (ciphertext em `data`).
 * - Somente dispositivos com a chave de equipe conseguem ler.
 * - Esta etapa será ligada no gateway de sync após configurar a chave.
 */

export type E2ECipherPayload = {
  v: 1;
  alg: 'AES-GCM';
  iv: string;
  ct: string;
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

export function isE2ECipherPayload(value: unknown): value is E2ECipherPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as E2ECipherPayload;
  return v.v === 1 && v.alg === 'AES-GCM' && typeof v.iv === 'string' && typeof v.ct === 'string';
}

/** Deriva chave AES-GCM a partir de passphrase (PBKDF2). */
export async function deriveTeamKeyFromPassphrase(
  passphrase: string,
  saltB64: string,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltB64) as BufferSource,
      iterations: 210_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(
  key: CryptoKey,
  plain: Record<string, unknown>,
): Promise<E2ECipherPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plain));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encoded);
  return {
    v: 1,
    alg: 'AES-GCM',
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ctBuf)),
  };
}

export async function decryptJson(
  key: CryptoKey,
  payload: E2ECipherPayload,
): Promise<Record<string, unknown>> {
  const iv = fromBase64(payload.iv);
  const ct = fromBase64(payload.ct);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(pt)) as Record<string, unknown>;
}

/** Flag de feature — ligada quando a chave de equipe estiver disponível na sessão. */
let activeTeamKey: CryptoKey | null = null;

export function setActiveTeamKey(key: CryptoKey | null): void {
  activeTeamKey = key;
}

export function getActiveTeamKey(): CryptoKey | null {
  return activeTeamKey;
}

export async function maybeEncryptForCloud(
  plain: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!activeTeamKey) return plain;
  const cipher = await encryptJson(activeTeamKey, plain);
  return { __e2e: cipher };
}

export async function maybeDecryptFromCloud(
  raw: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const e2e = (raw as { __e2e?: unknown }).__e2e;
  if (!isE2ECipherPayload(e2e) || !activeTeamKey) return raw;
  return decryptJson(activeTeamKey, e2e);
}
