import { describe, expect, it } from 'vitest';
import {
  MEMBER_FULL_FETCH_EVERY_TICKS,
  REALTIME_PULL_DEBOUNCE_MS,
  shouldForceFullFetchOnMemberPollTick,
  shouldForceFullFetchOnRealtimeEvent,
} from '../../src/offline-first/sync/memberCloudWatch';

describe('memberCloudWatch — políticas (dose 4)', () => {
  it('Realtime nunca força full fetch (chefe nem membro)', () => {
    expect(shouldForceFullFetchOnRealtimeEvent(true)).toBe(false);
    expect(shouldForceFullFetchOnRealtimeEvent(false)).toBe(false);
  });

  it('poll do membro força full só a cada N ticks', () => {
    expect(shouldForceFullFetchOnMemberPollTick(0)).toBe(false);
    expect(shouldForceFullFetchOnMemberPollTick(1)).toBe(false);
    expect(shouldForceFullFetchOnMemberPollTick(MEMBER_FULL_FETCH_EVERY_TICKS)).toBe(true);
    expect(shouldForceFullFetchOnMemberPollTick(MEMBER_FULL_FETCH_EVERY_TICKS * 2)).toBe(true);
    expect(shouldForceFullFetchOnMemberPollTick(MEMBER_FULL_FETCH_EVERY_TICKS + 1)).toBe(false);
  });

  it('debounce de pull Realtime é 2s (coalesce CSV)', () => {
    expect(REALTIME_PULL_DEBOUNCE_MS).toBe(2_000);
  });
});
