import {
  addAuthorizedEmail,
  listAuthorizedEmails,
  removeAuthorizedEmail,
} from './firebase/FirebaseGateway';
import { authorizedEmailRepository } from '../repositories/AuthorizedEmailRepository';
import { getTafDatabase } from '../db/tafDatabase';
import {
  provisionAuthorizedMemberE2eAccess,
  provisionE2eAccessForAllAuthorizedEmails,
} from '../../services/supabase/teamE2eSession';

/**
 * Espelha e-mails autorizados da nuvem no Dexie.
 * Sempre envia pendências locais antes do pull — evita apagar e-mails
 * acabados de cadastrar quando a nuvem ainda não os conhece.
 */
export async function pullAuthorizedEmailsToLocal(ownerUid: string): Promise<void> {
  await pushPendingAuthorizedEmails(ownerUid);
  const remote = await listAuthorizedEmails(ownerUid);
  await authorizedEmailRepository.replaceFromRemote(ownerUid, remote);
  // Garante desbloqueio automático para todos os autorizados (chefe com DEK).
  const emails = remote.map((e) => e.email);
  const local = await authorizedEmailRepository.listLocal(ownerUid);
  for (const row of local) {
    if (!emails.includes(row.email)) emails.push(row.email);
  }
  await provisionE2eAccessForAllAuthorizedEmails(ownerUid, emails);
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
        const removed = await removeAuthorizedEmail(ownerUid, row.email);
        if (!removed.ok) {
          errors.push(
            `authorizedEmails/${row.email}: ${removed.error ?? 'falha ao remover na nuvem'}`,
          );
          continue;
        }
      } else {
        const added = await addAuthorizedEmail(ownerUid, row.email);
        if (!added.ok) {
          errors.push(
            `authorizedEmails/${row.email}: ${added.error ?? 'falha ao autorizar na nuvem'}`,
          );
          continue;
        }
        const provisioned = await provisionAuthorizedMemberE2eAccess(ownerUid, row.email);
        if (!provisioned.ok && provisioned.skipped === 'dek_locked') {
          errors.push(
            `authorizedEmails/${row.email}: autorizado na nuvem, mas criptografia bloqueada — sincronize com escudo verde para liberar o acesso do membro.`,
          );
        } else if (!provisioned.ok) {
          errors.push(
            `authorizedEmails/${row.email}: autorizado, mas falhou liberar E2E (${provisioned.error ?? 'erro'})`,
          );
        }
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

  // Backfill: e-mails já autorizados sem access_secret (chefe com DEK).
  try {
    const all = await authorizedEmailRepository.listLocal(ownerUid);
    await provisionE2eAccessForAllAuthorizedEmails(
      ownerUid,
      all.map((e) => e.email),
    );
  } catch (error) {
    console.warn('[sync] provision E2E autorizados:', error);
  }

  return errors;
}
