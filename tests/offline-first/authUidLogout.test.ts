import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  clearPersistedStorageOwner,
  getCachedDataOwnerUid,
  getCachedLoginUid,
  setAuthUidState,
} from '../../src/services/firebase/authUid';

const OWNER = 'boss-uid-persist';

describe('authUid — logout mantém cache local', () => {
  beforeEach(() => {
    setAuthUidState('login-1', OWNER, true);
  });

  afterEach(() => {
    clearPersistedStorageOwner();
    setAuthUidState(null, null, true);
  });

  it('após logout, getCachedDataOwnerUid ainda resolve o dono dos dados', () => {
    setAuthUidState(null, null, true);
    expect(getCachedLoginUid()).toBeNull();
    expect(getCachedDataOwnerUid()).toBe(OWNER);
  });
});
