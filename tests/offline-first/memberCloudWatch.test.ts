import { describe, expect, it } from 'vitest';
import {
  MEMBER_FULL_FETCH_EVERY_TICKS,
  REALTIME_PULL_DEBOUNCE_MS,
  shouldForceFullFetchOnMemberPollTick,
  shouldForceFullFetchOnRealtimeEvent,
} from '../../src/offline-first/sync/memberCloudWatch';

describe('memberCloudWatch — políticas (dose 4)', () => {
  it('membro não força full fetch a cada evento Realtime', () => {
    expect(shouldForceFullFetchOnRealtimeEvent(true)).toBe(false);
  });

  it('chefe força full fetch no Realtime', () => {
    expect(shouldForceFullFetchOnRealtimeEvent(false)).toBe(true);
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
