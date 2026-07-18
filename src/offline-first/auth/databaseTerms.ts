import { readAppMeta, writeAppMeta, removeAppMeta } from '../db/appMeta';
import { normalizeAuthEmail } from '../../utils/normalizeAuthEmail';

/** Aceite dos termos de criação de banco, por UID do dono. */
export function databaseTermsMetaKey(uid: string): string {
  return `terms:newDatabaseAccepted:${uid.trim()}`;
}

const PENDING_EMAIL_KEY = 'terms:newDatabasePendingEmail';

/** Aceite pré-auth na tela de cadastro (ainda sem UID). */
let preAcceptedEmail: string | null = null;

export async function hasAcceptedNewDatabaseTerms(uid: string): Promise<boolean> {
  if (!uid.trim()) return false;
  const value = await readAppMeta(databaseTermsMetaKey(uid));
  return value === '1';
}

export async function markAcceptedNewDatabaseTerms(uid: string): Promise<void> {
  if (!uid.trim()) return;
  await writeAppMeta(databaseTermsMetaKey(uid), '1');
  preAcceptedEmail = null;
  await removeAppMeta(PENDING_EMAIL_KEY);
}

/** Marca que o usuário aceitou os termos na UI antes do cadastro/login. */
export function setDatabaseTermsPreAcceptedForEmail(email: string | null): void {
  const normalized = email?.trim() ? normalizeAuthEmail(email) : null;
  preAcceptedEmail = normalized;
  if (normalized) {
    void writeAppMeta(PENDING_EMAIL_KEY, normalized);
  } else {
    void removeAppMeta(PENDING_EMAIL_KEY);
  }
}

export function clearDatabaseTermsPreAccepted(): void {
  preAcceptedEmail = null;
  void removeAppMeta(PENDING_EMAIL_KEY);
}

export function peekDatabaseTermsPreAcceptedEmail(): string | null {
  return preAcceptedEmail;
}

/**
 * Se o e-mail autenticado bate com o aceite prévio na tela, confirma para o UID
 * e limpa o pendente — evita reabrir o modal após "Cadastrar".
 */
export async function consumeDatabaseTermsPreAccepted(
  uid: string,
  email: string | null | undefined,
): Promise<boolean> {
  const emailKey = email?.trim() ? normalizeAuthEmail(email) : null;
  let pending = preAcceptedEmail;
  if (!pending) {
    pending = await readAppMeta(PENDING_EMAIL_KEY);
  }
  if (!pending || !emailKey || pending !== emailKey) return false;
  await markAcceptedNewDatabaseTerms(uid);
  return true;
}
