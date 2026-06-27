import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetAppMetaCacheForTests,
  writeAppMetaSync,
} from '../../src/offline-first/db/appMeta';
import { resolveMemberAccess } from '../../src/services/firebase/authorizedEmailsFirestore';

const BOSS_UID = 'boss-persisted';
const MEMBER_UID = 'member-persisted';

describe('resolveMemberAccess — sessão persistida', () => {
  beforeEach(() => {
    resetAppMetaCacheForTests();
  });

  it('usa chefe do Dexie meta quando Firestore não resolve (offline)', async () => {
    writeAppMetaSync('session:dataOwnerUid', BOSS_UID);
    writeAppMetaSync('session:loginUid', MEMBER_UID);

    const access = await resolveMemberAccess(MEMBER_UID, 'membro@exemplo.com');
    expect(access).toEqual({
      dataOwnerUid: BOSS_UID,
      isAuthorizedMember: true,
    });
  });
});
