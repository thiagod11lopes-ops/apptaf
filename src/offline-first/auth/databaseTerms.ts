import { readAppMeta, writeAppMeta } from '../db/appMeta';

/** Aceite dos termos de criação de banco, por UID do dono. */
export function databaseTermsMetaKey(uid: string): string {
  return `terms:newDatabaseAccepted:${uid.trim()}`;
}

export async function hasAcceptedNewDatabaseTerms(uid: string): Promise<boolean> {
  if (!uid.trim()) return false;
  const value = await readAppMeta(databaseTermsMetaKey(uid));
  return value === '1';
}

export async function markAcceptedNewDatabaseTerms(uid: string): Promise<void> {
  if (!uid.trim()) return;
  await writeAppMeta(databaseTermsMetaKey(uid), '1');
}
