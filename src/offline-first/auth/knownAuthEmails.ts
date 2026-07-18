import { readAppMeta, writeAppMeta } from '../db/appMeta';
import { normalizeAuthEmail, isValidAuthEmail } from '../../utils/normalizeAuthEmail';

/**
 * E-mails que já autenticaram neste dispositivo.
 * Diferente do perfil de auth, esta lista NÃO é apagada no logout —
 * serve para o formulário não tratar uma conta conhecida como "novo banco".
 */
const KNOWN_EMAILS_KEY = 'auth:knownEmails';
const MAX_KNOWN_EMAILS = 20;

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

export async function rememberKnownAuthEmailOnDevice(email: string | null | undefined): Promise<void> {
  if (!email?.trim() || !isValidAuthEmail(email)) return;
  const key = normalizeAuthEmail(email);
  const known = await readKnownEmails();
  if (known.includes(key)) return;
  const next = [key, ...known].slice(0, MAX_KNOWN_EMAILS);
  await writeAppMeta(KNOWN_EMAILS_KEY, JSON.stringify(next));
}
