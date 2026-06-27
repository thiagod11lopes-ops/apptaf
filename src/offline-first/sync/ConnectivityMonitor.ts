import type { ConnectivityState } from '../types';
import { probeInternetReachable } from '../../utils/probeInternetReachable';
import { syncLogger } from './SyncLogger';

type Listener = (state: ConnectivityState) => void;

const listeners = new Set<Listener>();
let state: ConnectivityState =
  typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : 'ONLINE';
let pollTimer: ReturnType<typeof setInterval> | null = null;
let manualSyncLock = false;

function readNavigatorOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

async function probeInternet(): Promise<boolean> {
  return probeInternetReachable(4000);
}

function notify(): void {
  listeners.forEach((fn) => fn(state));
}

/** Avalia conectividade sem acessar Firestore (Firebase só no Sync Engine). */
async function evaluate(): Promise<ConnectivityState> {
  if (manualSyncLock) return 'SYNCING';
  if (!readNavigatorOnline()) return 'OFFLINE';

  const internet = await probeInternet();
  if (!internet) return 'OFFLINE';

  return 'ONLINE';
}

export class ConnectivityMonitor {
  start(): void {
    if (pollTimer) return;
    void this.refresh();
    pollTimer = setInterval(() => void this.refresh(), 8000);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.refresh());
      window.addEventListener('offline', () => void this.refresh());
    }
  }

  stop(): void {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async refresh(): Promise<ConnectivityState> {
    const next = await evaluate();
    if (next !== state) {
      state = next;
      await syncLogger.info('connectivity', `Estado: ${next}`);
      notify();
    }
    return state;
  }

  getState(): ConnectivityState {
    return state;
  }

  canSync(): boolean {
    return state === 'ONLINE' || state === 'SYNCING';
  }

  setSyncing(active: boolean): void {
    manualSyncLock = active;
    if (active) {
      state = 'SYNCING';
      notify();
      return;
    }
    if (readNavigatorOnline()) {
      state = 'ONLINE';
    } else {
      state = 'OFFLINE';
    }
    notify();
    void this.refresh();
  }

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }
}

export const connectivityMonitor = new ConnectivityMonitor();

export function getConnectivityState(): ConnectivityState {
  return state;
}

/** Compatibilidade com networkStatus legado. */
export function canAttemptCloudSync(): boolean {
  return connectivityMonitor.canSync() && readNavigatorOnline();
}

export function isOnlineLegacy(): boolean {
  return state === 'ONLINE' || state === 'SYNCING';
}
