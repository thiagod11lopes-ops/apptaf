import { doc, getDoc } from 'firebase/firestore';
import type { ConnectivityState } from '../types';
import { getFirestoreDb } from '../../config/firebase';
import { syncLogger } from './SyncLogger';

type Listener = (state: ConnectivityState) => void;

const REACHABILITY_URL = 'https://connectivitycheck.gstatic.com/generate_204';
const listeners = new Set<Listener>();
let state: ConnectivityState = 'OFFLINE';
let pollTimer: ReturnType<typeof setInterval> | null = null;
let manualSyncLock = false;

function readNavigatorOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

async function probeInternet(): Promise<boolean> {
  if (!readNavigatorOnline()) return false;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(REACHABILITY_URL, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timeout);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

async function probeFirestore(): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    const ref = doc(db, 'member_lookup', '__connectivity_probe__');
    await getDoc(ref);
    return true;
  } catch {
    return false;
  }
}

function notify(): void {
  listeners.forEach((fn) => fn(state));
}

async function evaluate(): Promise<ConnectivityState> {
  if (manualSyncLock) return 'SYNCING';
  if (!readNavigatorOnline()) return 'OFFLINE';

  const internet = await probeInternet();
  if (!internet) return 'OFFLINE';

  const firestore = await probeFirestore();
  if (!firestore) return 'DEGRADED';

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
    return state === 'ONLINE' || state === 'DEGRADED';
  }

  setSyncing(active: boolean): void {
    manualSyncLock = active;
    state = active ? 'SYNCING' : state;
    if (!active) void this.refresh();
    else notify();
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
