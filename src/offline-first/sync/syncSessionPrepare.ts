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

/** Prepara sessão de sync: permissões, migrações, wipe remoto, e-mails autorizados. */
export async function prepareSyncSession(
  loginUid: string,
  email: string | null,
): Promise<SyncSessionInfo> {
  const access = await resolveMemberAccess(loginUid, email);
  if (access.isAuthorizedMember && email) {
    await registerAuthorizedMemberLogin(access.dataOwnerUid, email, loginUid);
  }
  await applyTeamWipeIfNeeded(access.dataOwnerUid, loginUid);
  await migrateDeviceDataOnLogin(access.dataOwnerUid);
  await migrateLegacyToDexie(access.dataOwnerUid);
  setAuthUidState(loginUid, access.dataOwnerUid, true);
  await pullAuthorizedEmailsToLocal(access.dataOwnerUid);
  return {
    dataOwnerUid: access.dataOwnerUid,
    isAuthorizedMember: access.isAuthorizedMember,
  };
}
