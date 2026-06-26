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
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { connectivityMonitor, getConnectivityState } from '../offline-first/sync/ConnectivityMonitor';
import { syncEngine } from '../offline-first/sync/SyncEngine';
import { dataStore } from '../offline-first/store/DataStore';
import { getPendingSyncItems, type PendingSyncSummary } from '../offline-first/sync/pendingSyncItems';
import { systemState, SYSTEM_STATE, type SystemSyncMode } from '../offline-first/sync/SystemState';
import { confirmCloudDisplayReady } from '../offline-first/sync/cloudDisplayGate';
import type { ConnectivityState } from '../offline-first/types';

type OfflineSyncContextType = {
  online: boolean;
  connectivity: ConnectivityState;
  systemMode: SystemSyncMode;
  isForcedOffline: boolean;
  syncGateActive: boolean;
  pendingCount: number;
  pendingSummary: PendingSyncSummary;
  syncing: boolean;
  tryReturnToOnline: () => Promise<void>;
  openSyncPrompt: () => void;
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
  return state === 'ONLINE' || state === 'DEGRADED';
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [systemMode, setSystemMode] = useState<SystemSyncMode>(systemState.getMode());
  const [pendingSummary, setPendingSummary] = useState<PendingSyncSummary>(EMPTY_SUMMARY);
  const [syncing, setSyncing] = useState(false);
  const syncInFlight = useRef(false);
  const prevHasNetworkRef = useRef(hasNetworkConnectivity());
  const syncCheckedForSession = useRef(false);

  const online = hasNetworkConnectivity(connectivity);
  const isForcedOffline =
    systemMode === SYSTEM_STATE.FORCED_OFFLINE && !isAuthenticated;
  const pendingCount = pendingSummary.total;

  const refreshPending = useCallback(async (): Promise<PendingSyncSummary> => {
    const uid = getCachedDataOwnerUid();
    if (!uid || !isAuthenticated) {
      setPendingSummary(EMPTY_SUMMARY);
      return EMPTY_SUMMARY;
    }
    const summary = await getPendingSyncItems(uid);
    setPendingSummary(summary);
    return summary;
  }, [isAuthenticated]);

  const syncWhenOnline = useCallback(async () => {
    if (!authReady || !isAuthenticated || syncInFlight.current) return;
    if (!connectivityMonitor.canSync()) return;

    const uid = getCachedDataOwnerUid();
    if (!uid) return;

    syncInFlight.current = true;
    setSyncing(true);
    try {
      syncEngine.bindOwner(uid);
      await systemState.setOnlineActive();
      setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);

      const summary = await refreshPending();
      if (summary.total > 0) {
        await syncEngine.uploadPendingOnly();
        await refreshPending();
      }

      await syncEngine.connectOnlineFromCloud();
    } finally {
      confirmCloudDisplayReady();
      setSyncing(false);
      syncInFlight.current = false;
    }
  }, [authReady, isAuthenticated, refreshPending]);

  const tryReturnToOnline = useCallback(async () => {
    await systemState.setOnlineActive();
    setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
    await syncWhenOnline();
  }, [syncWhenOnline]);

  const openSyncPrompt = useCallback(() => {
    if (!isAuthenticated || !connectivityMonitor.canSync()) return;
    void syncWhenOnline();
  }, [isAuthenticated, syncWhenOnline]);

  useEffect(() => {
    void systemState.hydrate().then(setSystemMode);
    return systemState.subscribe(setSystemMode);
  }, []);

  useEffect(() => {
    connectivityMonitor.start();
    return connectivityMonitor.subscribe((state) => {
      setConnectivity(state);
      const hasNetwork = hasNetworkConnectivity(state);
      const hadNetwork = prevHasNetworkRef.current;
      prevHasNetworkRef.current = hasNetwork;

      if (hadNetwork && !hasNetwork && authReady && isAuthenticated) {
        syncEngine.deactivateOnlineMode();
      }
      if (!hadNetwork && hasNetwork && authReady && isAuthenticated) {
        void syncWhenOnline();
      }
    });
  }, [authReady, isAuthenticated, syncWhenOnline]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      syncCheckedForSession.current = false;
      return;
    }
    if (syncCheckedForSession.current) return;
    syncCheckedForSession.current = true;
    void syncWhenOnline();
  }, [authReady, isAuthenticated, syncWhenOnline]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void refreshPending();
    return dataStore.subscribe(() => {
      if (syncInFlight.current) return;
      if (!connectivityMonitor.canSync()) return;
      void refreshPending().then((summary) => {
        if (summary.total > 0) {
          void syncWhenOnline();
        }
      });
    });
  }, [authReady, isAuthenticated, refreshPending, syncWhenOnline]);

  const value = useMemo(
    () => ({
      online,
      connectivity,
      systemMode,
      isForcedOffline,
      syncGateActive: false,
      pendingCount,
      pendingSummary,
      syncing: syncing || connectivity === 'SYNCING',
      tryReturnToOnline,
      openSyncPrompt,
    }),
    [
      online,
      connectivity,
      systemMode,
      isForcedOffline,
      pendingCount,
      pendingSummary,
      syncing,
      tryReturnToOnline,
      openSyncPrompt,
    ],
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
