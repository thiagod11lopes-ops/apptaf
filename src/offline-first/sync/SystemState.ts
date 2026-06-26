import { setMeta, getMeta } from '../db/tafDatabase';

/** Estado de sincronização — sempre online quando logado (sem modo offline controlado). */
export type SystemSyncMode = 'ONLINE_ACTIVE';

export const SYSTEM_STATE = {
  ONLINE_ACTIVE: 'ONLINE_ACTIVE' as const,
};

const META_KEY = 'systemSyncMode';
const listeners = new Set<(mode: SystemSyncMode) => void>();

function notify(mode: SystemSyncMode): void {
  listeners.forEach((fn) => fn(mode));
}

let cachedMode: SystemSyncMode = SYSTEM_STATE.ONLINE_ACTIVE;

export const systemState = {
  getMode(): SystemSyncMode {
    return cachedMode;
  },

  /** Firebase é fonte de leitura quando o usuário está logado e com conectividade. */
  canUseFirebase(): boolean {
    return true;
  },

  async hydrate(): Promise<SystemSyncMode> {
    const stored = await getMeta(META_KEY);
    if (stored === 'FORCED_OFFLINE') {
      await setMeta(META_KEY, SYSTEM_STATE.ONLINE_ACTIVE);
    }
    cachedMode = SYSTEM_STATE.ONLINE_ACTIVE;
    return cachedMode;
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
