import {
  addAuthorizedEmail,
  listAuthorizedEmails,
  removeAuthorizedEmail,
} from './firebase/FirebaseGateway';
import { authorizedEmailRepository } from '../repositories/AuthorizedEmailRepository';
import { getTafDatabase } from '../db/tafDatabase';

/**
 * Espelha e-mails autorizados da nuvem no Dexie.
 * Sempre envia pendências locais antes do pull — evita apagar e-mails
 * acabados de cadastrar quando a nuvem ainda não os conhece.
 */
export async function pullAuthorizedEmailsToLocal(ownerUid: string): Promise<void> {
  await pushPendingAuthorizedEmails(ownerUid);
  const remote = await listAuthorizedEmails(ownerUid);
  await authorizedEmailRepository.replaceFromRemote(ownerUid, remote);
}

export async function pushPendingAuthorizedEmails(ownerUid: string): Promise<string[]> {
  const { getCachedLoginUid } = await import('../../services/firebase/authUid');
  const loginUid = getCachedLoginUid();
  if (loginUid && loginUid !== ownerUid) {
    return [];
  }

  const errors: string[] = [];
  const pending = await authorizedEmailRepository.listPendingSync(ownerUid);
  const db = getTafDatabase();

  for (const row of pending) {
    try {
      if (row.syncStatus === 'deleted') {
        await removeAuthorizedEmail(ownerUid, row.email);
      } else {
        await addAuthorizedEmail(ownerUid, row.email);
      }
      if (db) {
        await db.authorizedEmails.put({
          ...row,
          syncStatus: 'synced',
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      errors.push(
        `authorizedEmails/${row.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return errors;
}
