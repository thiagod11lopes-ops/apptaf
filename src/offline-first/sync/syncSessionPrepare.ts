import {
  resolveMemberAccess,
  registerAuthorizedMemberLogin,
} from './firebase/FirebaseGateway';
import { setAuthUidState } from '../../services/firebase/authUid';
import { migrateDeviceDataOnLogin, migrateLegacyToDexie } from '../db/migration';
import { applyTeamWipeIfNeeded } from './syncTeamWipe';
import { pullAuthorizedEmailsToLocal } from './syncAuthorizedEmails';

export type SyncSessionInfo = {
  dataOwnerUid: string;
  isAuthorizedMember: boolean;
};

/**
 * Resolve chefe/membro, registra acesso na nuvem e prepara IndexedDB local.
 * Deve rodar no login — não apenas ao sincronizar.
 */
export async function resolveLocalSessionAfterLogin(
  loginUid: string,
  email: string | null | undefined,
): Promise<SyncSessionInfo> {
  const access = await resolveMemberAccess(loginUid, email);
  if (access.isAuthorizedMember && email?.trim()) {
    const registered = await registerAuthorizedMemberLogin(access.dataOwnerUid, email, loginUid);
    if (!registered.ok) {
      console.warn('[auth] registerAuthorizedMemberLogin no login:', registered.error);
    }
  }
  try {
    await migrateDeviceDataOnLogin(access.dataOwnerUid);
    await migrateLegacyToDexie(access.dataOwnerUid);
  } catch (error) {
    console.warn('[auth] migrateDeviceDataOnLogin falhou:', error);
  }
  setAuthUidState(loginUid, access.dataOwnerUid, true);
  return access;
}

/** Prepara sessão de sync: permissões, migrações, wipe remoto, e-mails autorizados. */
export async function prepareSyncSession(
  loginUid: string,
  email: string | null,
): Promise<SyncSessionInfo> {
  const access = await resolveLocalSessionAfterLogin(loginUid, email);
  if (access.isAuthorizedMember && email) {
    const registered = await registerAuthorizedMemberLogin(access.dataOwnerUid, email, loginUid);
    if (!registered.ok) {
      throw new Error(
        registered.error ??
          'Não foi possível registrar seu acesso à nuvem do chefe. Entre novamente com o e-mail autorizado.',
      );
    }
  }
  await applyTeamWipeIfNeeded(access.dataOwnerUid, loginUid);
  if (!access.isAuthorizedMember) {
    await pullAuthorizedEmailsToLocal(access.dataOwnerUid);
  }
  return access;
}
