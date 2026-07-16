import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetAppMetaCacheForTests,
  writeAppMetaSync,
} from '../../src/offline-first/db/appMeta';
import { resolveMemberAccess } from '../../src/services/firebase/authorizedEmailsFirestore';

const BOSS_UID = '11111111-1111-4111-8111-111111111111';
const MEMBER_UID = '22222222-2222-4222-8222-222222222222';

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

  it('ignora owner legado do Firebase (não-UUID) na sessão persistida', async () => {
    writeAppMetaSync('session:dataOwnerUid', '3H2MrgN6nmb7pmm5soyGToRVV562');
    writeAppMetaSync('session:loginUid', MEMBER_UID);

    const access = await resolveMemberAccess(MEMBER_UID, 'membro@exemplo.com');
    expect(access).toEqual({
      dataOwnerUid: MEMBER_UID,
      isAuthorizedMember: false,
    });
  });
});
