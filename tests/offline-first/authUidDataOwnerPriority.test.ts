import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetAppMetaCacheForTests,
  writeAppMetaSync,
} from '../../src/offline-first/db/appMeta';
import {
  getCachedDataOwnerUid,
  resetAuthUidStateForTests,
  setAuthUidState,
} from '../../src/services/firebase/authUid';

const BOSS_UID = 'boss-uid-99';
const MEMBER_UID = 'member-uid-42';

describe('getCachedDataOwnerUid — membro autorizado', () => {
  beforeEach(() => {
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
  });

  afterEach(() => {
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
    setAuthUidState(null, null, true);
  });

  it('prioriza ownerUid persistido (chefe) em vez do loginUid do membro', () => {
    writeAppMetaSync('session:dataOwnerUid', BOSS_UID);
    writeAppMetaSync('session:loginUid', MEMBER_UID);

    expect(getCachedDataOwnerUid()).toBe(BOSS_UID);
  });

  it('após login de membro, resolve chefe via setAuthUidState', () => {
    setAuthUidState(MEMBER_UID, BOSS_UID, true);
    expect(getCachedDataOwnerUid()).toBe(BOSS_UID);
  });
});
