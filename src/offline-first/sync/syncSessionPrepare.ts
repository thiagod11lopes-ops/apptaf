import {
  resolveMemberAccess,
  registerAuthorizedMemberLogin,
} from './firebase/FirebaseGateway';
import { setAuthUidState } from '../../services/firebase/authUid';
import { migrateDeviceDataOnLogin, migrateLegacyToDexie } from '../db/migration';
import { migratePreCadastrosFromAppMeta } from '../db/preCadastroLocalDb';
import { applyTeamWipeIfNeeded } from './syncTeamWipe';
import { pullAuthorizedEmailsToLocal } from './syncAuthorizedEmails';
import { isCloudOwnerUid } from '../../utils/cloudOwnerUid';

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
  const dataOwnerUid =
    isCloudOwnerUid(access.dataOwnerUid) ? access.dataOwnerUid : loginUid;
  const isAuthorizedMember =
    access.isAuthorizedMember && isCloudOwnerUid(dataOwnerUid) && dataOwnerUid !== loginUid;

  if (isAuthorizedMember && email?.trim()) {
    const registered = await registerAuthorizedMemberLogin(dataOwnerUid, email, loginUid);
    if (!registered.ok) {
      console.warn('[auth] registerAuthorizedMemberLogin no login:', registered.error);
    }
  }
  try {
    await migrateDeviceDataOnLogin(dataOwnerUid);
    await migrateLegacyToDexie(dataOwnerUid);
    await migratePreCadastrosFromAppMeta(dataOwnerUid);
  } catch (error) {
    console.warn('[auth] migrateDeviceDataOnLogin falhou:', error);
  }
  setAuthUidState(loginUid, dataOwnerUid, true);
  return { dataOwnerUid, isAuthorizedMember };
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
      // Não bloqueia sync: RLS já libera por e-mail em member_lookup.
      console.warn(
        '[sync] registerAuthorizedMemberLogin (seguindo sync):',
        registered.error ??
          'Não foi possível registrar member_uid_lookup; acesso por e-mail continua válido.',
      );
    }
  }
  try {
    await applyTeamWipeIfNeeded(access.dataOwnerUid, loginUid);
  } catch (error) {
    console.warn('[sync] applyTeamWipeIfNeeded falhou (seguindo sync):', error);
  }
  if (!access.isAuthorizedMember) {
    try {
      await pullAuthorizedEmailsToLocal(access.dataOwnerUid);
    } catch (error) {
      console.warn('[sync] pullAuthorizedEmailsToLocal falhou (seguindo sync):', error);
    }
  }
  return access;
}
