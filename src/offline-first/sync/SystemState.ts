import { setMeta, getMeta } from '../db/tafDatabase';

/** Modo global: offline (padrão) ou online (sync manual em andamento). */
export type SystemSyncMode = 'OFFLINE' | 'ONLINE';

export const SYSTEM_STATE = {
  OFFLINE: 'OFFLINE' as const,
  ONLINE: 'ONLINE' as const,
};

const META_KEY = 'systemSyncMode';
const listeners = new Set<(mode: SystemSyncMode) => void>();

function notify(mode: SystemSyncMode): void {
  listeners.forEach((fn) => fn(mode));
}

let cachedMode: SystemSyncMode = SYSTEM_STATE.OFFLINE;

export const systemState = {
  getMode(): SystemSyncMode {
    return cachedMode;
  },

  isOffline(): boolean {
    return cachedMode === SYSTEM_STATE.OFFLINE;
  },

  /** Firebase só é acessível durante sync manual explícita. */
  canUseFirebase(): boolean {
    return cachedMode === SYSTEM_STATE.ONLINE;
  },

  async hydrate(): Promise<SystemSyncMode> {
    const stored = await getMeta(META_KEY);
    if (stored === 'ONLINE_ACTIVE' || stored === 'ONLINE') {
      await setMeta(META_KEY, SYSTEM_STATE.OFFLINE);
    }
    cachedMode = SYSTEM_STATE.OFFLINE;
    return cachedMode;
  },

  async setOfflineMode(): Promise<void> {
    cachedMode = SYSTEM_STATE.OFFLINE;
    await setMeta(META_KEY, SYSTEM_STATE.OFFLINE);
    notify(cachedMode);
  },

  async setOnlineMode(): Promise<void> {
    cachedMode = SYSTEM_STATE.ONLINE;
    await setMeta(META_KEY, SYSTEM_STATE.ONLINE);
    notify(cachedMode);
  },

  /** @deprecated use setOnlineMode */
  async setOnlineActive(): Promise<void> {
    await this.setOnlineMode();
  },

  subscribe(listener: (mode: SystemSyncMode) => void): () => void {
    listeners.add(listener);
    listener(cachedMode);
    return () => listeners.delete(listener);
  },
};
