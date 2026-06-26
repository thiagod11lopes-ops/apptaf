import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { connectivityMonitor, getConnectivityState } from '../offline-first/sync/ConnectivityMonitor';
import { syncManager, subscribeSyncManager, getSyncManagerState, type SyncManagerState } from '../offline-first/sync/SyncManager';
import type { PendingSyncSummary } from '../offline-first/sync/pendingSyncItems';
import type { ConnectivityState } from '../offline-first/types';

type OfflineSyncContextType = {
  online: boolean;
  connectivity: ConnectivityState;
  pendingCount: number;
  pendingSummary: PendingSyncSummary;
  syncing: boolean;
};

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

const EMPTY_SUMMARY: PendingSyncSummary = {
  items: [],
  total: 0,
  cadastros: 0,
  sessoes: 0,
  aplicadores: 0,
};

function hasNetworkConnectivity(state: ConnectivityState = getConnectivityState()): boolean {
  return state === 'ONLINE' || state === 'DEGRADED' || state === 'SYNCING';
}

function readBrowserOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [managerState, setManagerState] = useState<SyncManagerState>(getSyncManagerState);
  const prevHasNetworkRef = useRef(false);

  const online = hasNetworkConnectivity(connectivity) || (isAuthenticated && readBrowserOnline());
  const pendingSummary = managerState.pendingSummary;
  const pendingCount = pendingSummary.total;

  const evaluateSession = useCallback(async () => {
    if (!authReady || !isAuthenticated) return;
    await syncManager.evaluateOnSessionStart();
  }, [authReady, isAuthenticated]);

  useEffect(() => {
    return subscribeSyncManager(setManagerState);
  }, []);

  useEffect(() => {
    connectivityMonitor.start();
    prevHasNetworkRef.current = hasNetworkConnectivity();
    return connectivityMonitor.subscribe((state) => {
      setConnectivity(state);
      const hasNetwork = hasNetworkConnectivity(state);
      const hadNetwork = prevHasNetworkRef.current;
      prevHasNetworkRef.current = hasNetwork;

      if (hadNetwork && !hasNetwork && authReady && isAuthenticated) {
        syncManager.onDisconnect();
      }
      if (!hadNetwork && hasNetwork && authReady && isAuthenticated) {
        void syncManager.evaluateOnReconnect();
      }
    });
  }, [authReady, isAuthenticated]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void evaluateSession();
  }, [authReady, isAuthenticated, evaluateSession]);

  const value = useMemo(
    () => ({
      online,
      connectivity,
      pendingCount,
      pendingSummary,
      syncing: managerState.uploading || connectivity === 'SYNCING',
    }),
    [online, connectivity, pendingCount, pendingSummary, managerState.uploading],
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSyncState(): OfflineSyncContextType {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSyncState deve ser usado dentro de OfflineSyncProvider');
  }
  return ctx;
}
