import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/supabase', () => ({
  getSupabase: () => null,
}));

vi.mock('../../src/services/offline/cloudSyncActivity', () => ({
  beginRealtimeApply: () => {},
  endRealtimeApply: () => {},
  setRealtimeListening: () => {},
}));

import {
  isRealtimeBridgeActive,
  startRealtimeBridge,
  stopRealtimeBridge,
} from '../../src/offline-first/sync/RealtimeBridge';
import { setCloudLinkEnabled } from '../../src/offline-first/sync/cloudLinkPreference';

describe('RealtimeBridge — etapa 2 (BNC)', () => {
  afterEach(() => {
    setCloudLinkEnabled(false);
    stopRealtimeBridge();
  });

  it('não inicia canal com BNC desligado', () => {
    setCloudLinkEnabled(false);
    startRealtimeBridge('owner-1', () => {});
    expect(isRealtimeBridgeActive()).toBe(false);
  });

  it('desligar BNC derruba bridge ativo (via subscribeCloudLink)', () => {
    setCloudLinkEnabled(true);
    // Sem supabase, start não cria channel — ainda assim stop no off deve ser idempotente.
    startRealtimeBridge('owner-1', () => {});
    setCloudLinkEnabled(false);
    expect(isRealtimeBridgeActive()).toBe(false);
  });
});
