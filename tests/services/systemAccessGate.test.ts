import { describe, expect, it } from 'vitest';
import {
  SYSTEM_ACCESS_BLOCKED_MESSAGE,
  SystemAccessBlockedError,
  isSystemAccessBlockedError,
} from '../../src/services/supabase/systemAccessGate';

describe('systemAccessGate', () => {
  it('reconhece SystemAccessBlockedError', () => {
    const err = new SystemAccessBlockedError();
    expect(err.message).toBe(SYSTEM_ACCESS_BLOCKED_MESSAGE);
    expect(isSystemAccessBlockedError(err)).toBe(true);
    expect(isSystemAccessBlockedError(new Error(SYSTEM_ACCESS_BLOCKED_MESSAGE))).toBe(true);
    expect(isSystemAccessBlockedError(new Error('outro'))).toBe(false);
  });
});
