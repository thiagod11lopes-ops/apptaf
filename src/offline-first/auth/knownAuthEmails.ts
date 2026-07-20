import { readAppMeta, writeAppMeta } from '../db/appMeta';
import { normalizeAuthEmail, isValidAuthEmail } from '../../utils/normalizeAuthEmail';

/**
 * E-mails que já autenticaram neste dispositivo.
 * Diferente do perfil de auth, esta lista NÃO é apagada no logout —
 * serve para o formulário não tratar uma conta conhecida como "novo banco"
 * e para sugerir os e-mails recentes no campo Conta.
 */
const KNOWN_EMAILS_KEY = 'auth:knownEmails';
const MAX_KNOWN_EMAILS = 20;
export const RECENT_AUTH_EMAILS_SUGGEST_LIMIT = 3;
/** Sugestões a partir desta quantidade de caracteres digitados. */
export const AUTH_EMAIL_SUGGEST_MIN_CHARS = 3;

async function readKnownEmails(): Promise<string[]> {
  const raw = await readAppMeta(KNOWN_EMAILS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

export async function isKnownAuthEmailOnDevice(email: string | null | undefined): Promise<boolean> {
  if (!email?.trim() || !isValidAuthEmail(email)) return false;
  const key = normalizeAuthEmail(email);
  const known = await readKnownEmails();
  return known.includes(key);
}

/** Registra/atualiza e-mail (mais recente primeiro). */
export async function rememberKnownAuthEmailOnDevice(email: string | null | undefined): Promise<void> {
  if (!email?.trim() || !isValidAuthEmail(email)) return;
  const key = normalizeAuthEmail(email);
  const known = await readKnownEmails();
  const next = [key, ...known.filter((item) => item !== key)].slice(0, MAX_KNOWN_EMAILS);
  await writeAppMeta(KNOWN_EMAILS_KEY, JSON.stringify(next));
}

/** Últimos e-mails usados neste dispositivo (mais recente primeiro). */
export async function listRecentKnownAuthEmails(
  limit = RECENT_AUTH_EMAILS_SUGGEST_LIMIT,
): Promise<string[]> {
  const known = await readKnownEmails();
  return known.slice(0, Math.max(0, limit));
}

/** Filtra os recentes a partir da 3ª letra digitada. */
export function filterRecentAuthEmailSuggestions(
  query: string,
  recent: string[],
  limit = RECENT_AUTH_EMAILS_SUGGEST_LIMIT,
): string[] {
  const q = normalizeAuthEmail(query);
  if (q.length < AUTH_EMAIL_SUGGEST_MIN_CHARS) return [];
  return recent
    .filter((item) => {
      const email = normalizeAuthEmail(item);
      return email.includes(q) && email !== q;
    })
    .slice(0, Math.max(0, limit));
}
