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

/** Logado + rede → sempre pode usar nuvem; offline controlado só sem login. */
function canAttemptSyncNow(isAuthenticated: boolean): boolean {
  if (!connectivityMonitor.canSync()) return false;
  if (isAuthenticated) return true;
  return !systemState.isForcedOffline();
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady, logout, isBoss } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [systemMode, setSystemMode] = useState<SystemSyncMode>(systemState.getMode());
  const [pendingSummary, setPendingSummary] = useState<PendingSyncSummary>(EMPTY_SUMMARY);
  const [gateVisible, setGateVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const gateCheckInFlight = useRef(false);
  const syncGateBusyRef = useRef(false);
  const bossSkippedUploadRef = useRef(false);
  const prevHasNetworkRef = useRef(hasNetworkConnectivity());
  const gateCheckedForSession = useRef(false);

  const online = hasNetworkConnectivity(connectivity);
  const isForcedOffline =
    systemMode === SYSTEM_STATE.FORCED_OFFLINE && !isAuthenticated;
  const pendingCount = pendingSummary.total;

  const reconcileCloudWhenLoggedIn = useCallback(async () => {
    if (!authReady || !isAuthenticated) return;
    if (!connectivityMonitor.canSync()) return;
    if (!systemState.isForcedOffline()) return;
    await systemState.setOnlineActive();
    setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
  }, [authReady, isAuthenticated]);

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
    if (!connectivityMonitor.canSync()) return;

    gateCheckInFlight.current = true;
    try {
      await reconcileCloudWhenLoggedIn();
      await syncEngine.cacheCloudSnapshotLocally();
      const summary = await refreshPending();
      if (summary.total > 0) {
        if (isBoss && bossSkippedUploadRef.current) {
          setGateVisible(false);
          if (!syncEngine.isOnlineModeActive()) {
            await systemState.setOnlineActive();
            setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
            await syncEngine.enableOnlineMode();
          }
          return;
        }
        setGateVisible(true);
        return;
      }
      setGateVisible(false);
      if (syncEngine.isOnlineModeActive()) return;
      await systemState.setOnlineActive();
      setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
      await syncEngine.enableOnlineMode();
    } finally {
      gateCheckInFlight.current = false;
    }
  }, [authReady, isAuthenticated, isBoss, reconcileCloudWhenLoggedIn, refreshPending]);

  const handleContinueOnlineWithoutUpload = useCallback(async () => {
    if (!isBoss) return;
    bossSkippedUploadRef.current = true;
    setGateVisible(false);
    await systemState.setOnlineActive();
    setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
    await syncEngine.enableOnlineMode();
  }, [isBoss]);

  const handleUpload = useCallback(async () => {
    if (syncGateBusyRef.current) return;
    syncGateBusyRef.current = true;
    setSyncing(true);
    try {
      await syncEngine.uploadPendingOnly();
      const summary = await refreshPending();
      if (summary.total === 0) {
        setGateVisible(false);
        bossSkippedUploadRef.current = false;
        setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
      }
    } finally {
      setSyncing(false);
      setTimeout(() => {
        syncGateBusyRef.current = false;
      }, 0);
    }
  }, [refreshPending]);

  const handleWorkOffline = useCallback(async () => {
    if (!isBoss) return;
    bossSkippedUploadRef.current = false;
    await systemState.setForcedOffline();
    syncEngine.deactivateOnlineMode();
    setSystemMode(SYSTEM_STATE.FORCED_OFFLINE);
    setGateVisible(false);
    await logout({ preserveForcedOffline: true });
  }, [isBoss, logout]);

  const tryReturnToOnline = useCallback(async () => {
    await systemState.setOnlineActive();
    setSystemMode(SYSTEM_STATE.ONLINE_ACTIVE);
    await evaluateSyncGate();
  }, [evaluateSyncGate]);

  const openSyncPrompt = useCallback(() => {
    if (pendingCount <= 0 || !canAttemptSyncNow(isAuthenticated)) return;
    setGateVisible(true);
  }, [isAuthenticated, pendingCount]);

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
        setGateVisible(false);
      }
      if (!hadNetwork && hasNetwork && authReady && isAuthenticated) {
        void reconcileCloudWhenLoggedIn().then(() => evaluateSyncGate());
      }
    });
  }, [authReady, isAuthenticated, evaluateSyncGate, reconcileCloudWhenLoggedIn]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      gateCheckedForSession.current = false;
      bossSkippedUploadRef.current = false;
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
      if (syncGateBusyRef.current) return;
      void refreshPending().then((summary) => {
        if (syncGateBusyRef.current) return;
        if (summary.total === 0) {
          setGateVisible(false);
          bossSkippedUploadRef.current = false;
          return;
        }
        if (isBoss && bossSkippedUploadRef.current) return;
        if (canAttemptSyncNow(isAuthenticated)) {
          setGateVisible(true);
        }
      });
    });
  }, [authReady, isAuthenticated, isBoss, refreshPending]);

  const value = useMemo(
    () => ({
      online,
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
      {isAuthenticated ? (
        <SincronizacaoNecessariaModal
          visible={gateVisible && canAttemptSyncNow(isAuthenticated)}
          summary={pendingSummary}
          loading={syncing}
          allowSkipUploadOnline={isBoss}
          onUpload={() => void handleUpload()}
          onContinueOnline={isBoss ? () => void handleContinueOnlineWithoutUpload() : undefined}
          onWorkOffline={isBoss ? () => void handleWorkOffline() : undefined}
        />
      ) : null}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncState(): OfflineSyncContextType {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSyncState deve ser usado dentro de OfflineSyncProvider');
  }
  return ctx;
}
