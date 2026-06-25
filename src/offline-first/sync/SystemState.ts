import { stopRealtimeSync } from './RealtimeBridge';
import { setMeta, getMeta } from '../db/tafDatabase';

/** Estado global de sincronização controlada pelo usuário. */
export type SystemSyncMode = 'ONLINE_ACTIVE' | 'FORCED_OFFLINE';

export const SYSTEM_STATE = {
  ONLINE_ACTIVE: 'ONLINE_ACTIVE' as const,
  FORCED_OFFLINE: 'FORCED_OFFLINE' as const,
};

const META_KEY = 'systemSyncMode';
const listeners = new Set<(mode: SystemSyncMode) => void>();

function notify(mode: SystemSyncMode): void {
  listeners.forEach((fn) => fn(mode));
}

async function readMode(): Promise<SystemSyncMode> {
  const stored = await getMeta(META_KEY);
  if (stored === SYSTEM_STATE.FORCED_OFFLINE) return SYSTEM_STATE.FORCED_OFFLINE;
  return SYSTEM_STATE.ONLINE_ACTIVE;
}

let cachedMode: SystemSyncMode = SYSTEM_STATE.ONLINE_ACTIVE;

export const systemState = {
  getMode(): SystemSyncMode {
    return cachedMode;
  },

  isForcedOffline(): boolean {
    return cachedMode === SYSTEM_STATE.FORCED_OFFLINE;
  },

  /** Firebase só é fonte de verdade quando ONLINE_ACTIVE. */
  canUseFirebase(): boolean {
    return cachedMode === SYSTEM_STATE.ONLINE_ACTIVE;
  },

  async hydrate(): Promise<SystemSyncMode> {
    cachedMode = await readMode();
    return cachedMode;
  },

  async setForcedOffline(): Promise<void> {
    cachedMode = SYSTEM_STATE.FORCED_OFFLINE;
    await setMeta(META_KEY, SYSTEM_STATE.FORCED_OFFLINE);
    stopRealtimeSync();
    notify(cachedMode);
  },

  async setOnlineActive(): Promise<void> {
    cachedMode = SYSTEM_STATE.ONLINE_ACTIVE;
    await setMeta(META_KEY, SYSTEM_STATE.ONLINE_ACTIVE);
    notify(cachedMode);
  },

  subscribe(listener: (mode: SystemSyncMode) => void): () => void {
    listeners.add(listener);
    listener(cachedMode);
    return () => listeners.delete(listener);
  },
};
