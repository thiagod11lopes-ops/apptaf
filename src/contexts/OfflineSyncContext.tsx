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
import { SincronizacaoNecessariaModal } from '../components/sismav/SincronizacaoNecessariaModal';
import { OfflineStatusBanner } from '../components/sismav/OfflineStatusBanner';
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
};

function canAttemptSyncNow(): boolean {
  return connectivityMonitor.canSync() && !systemState.isForcedOffline();
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [systemMode, setSystemMode] = useState<SystemSyncMode>(systemState.getMode());
  const [pendingSummary, setPendingSummary] = useState<PendingSyncSummary>(EMPTY_SUMMARY);
  const [gateVisible, setGateVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const gateCheckInFlight = useRef(false);
  const prevCanSyncRef = useRef(canAttemptSyncNow());
  const gateCheckedForSession = useRef(false);

  const online =
    connectivity === 'ONLINE' || connectivity === 'DEGRADED' || connectivity === 'SYNCING';
  const isForcedOffline = systemMode === SYSTEM_STATE.FORCED_OFFLINE;
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

  const evaluateSyncGate = useCallback(async () => {
    if (!authReady || !isAuthenticated || gateCheckInFlight.current) return;
    if (!canAttemptSyncNow()) return;

    const uid = getCachedDataOwnerUid();
    if (!uid) return;

    gateCheckInFlight.current = true;
    try {
      const summary = await refreshPending();
      if (summary.total > 0) {
        setGateVisible(true);
        return;
      }
      setGateVisible(false);
      if (syncEngine.isOnlineModeActive()) return;
      await systemState.setOnlineActive();
      await syncEngine.enableOnlineMode();
    } finally {
      gateCheckInFlight.current = false;
    }
  }, [authReady, isAuthenticated, refreshPending]);

  const handleUpload = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncEngine.uploadPendingOnly();
      if (result.success) {
        setGateVisible(false);
        setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
        await refreshPending();
      }
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  const handleWorkOffline = useCallback(async () => {
    await systemState.setForcedOffline();
    syncEngine.deactivateOnlineMode();
    setSystemMode(SYSTEM_STATE.FORCED_OFFLINE);
    setGateVisible(false);
  }, []);

  const tryReturnToOnline = useCallback(async () => {
    await systemState.setOnlineActive();
    setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
    await evaluateSyncGate();
  }, [evaluateSyncGate]);

  const openSyncPrompt = useCallback(() => {
    if (pendingCount <= 0) return;
    setGateVisible(true);
  }, [pendingCount]);

  useEffect(() => {
    void systemState.hydrate().then(setSystemMode);
    return systemState.subscribe(setSystemMode);
  }, []);

  useEffect(() => {
    connectivityMonitor.start();
    return connectivityMonitor.subscribe((state) => {
      setConnectivity(state);
      const canSync = state === 'ONLINE' || state === 'DEGRADED';
      const nowCanSync = canSync && !systemState.isForcedOffline();
      const wasCanSync = prevCanSyncRef.current;
      prevCanSyncRef.current = nowCanSync;
      if (!wasCanSync && nowCanSync && authReady && isAuthenticated) {
        void evaluateSyncGate();
      }
    });
  }, [authReady, isAuthenticated, evaluateSyncGate]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      gateCheckedForSession.current = false;
      return;
    }
    if (gateCheckedForSession.current) return;
    gateCheckedForSession.current = true;
    void evaluateSyncGate();
  }, [authReady, isAuthenticated, evaluateSyncGate]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void refreshPending();
    return dataStore.subscribe(() => {
      void refreshPending().then((summary) => {
        if (summary.total > 0 && canAttemptSyncNow()) {
          setGateVisible(true);
        }
      });
    });
  }, [authReady, isAuthenticated, refreshPending]);

  const value = useMemo(
    () => ({
      online: isForcedOffline ? false : online,
      connectivity,
      systemMode,
      isForcedOffline,
      syncGateActive: gateVisible,
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
      gateVisible,
      pendingCount,
      pendingSummary,
      syncing,
      tryReturnToOnline,
      openSyncPrompt,
    ],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
      {isAuthenticated && isForcedOffline ? (
        <OfflineStatusBanner
          offline
          forcedOffline
          pendingCount={pendingCount}
          onPressSync={() => void tryReturnToOnline()}
        />
      ) : null}
      {isAuthenticated ? (
        <SincronizacaoNecessariaModal
          visible={gateVisible}
          summary={pendingSummary}
          loading={syncing}
          onUpload={() => void handleUpload()}
          onWorkOffline={() => void handleWorkOffline()}
        />
      ) : null}
    </OfflineSyncContext.Provider>
  );
}

export function OfflineSyncBanner() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return null;
  return <OfflineStatusBanner offline pendingCount={0} />;
}

export function useOfflineSyncState(): OfflineSyncContextType {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSyncState deve ser usado dentro de OfflineSyncProvider');
  }
  return ctx;
}
