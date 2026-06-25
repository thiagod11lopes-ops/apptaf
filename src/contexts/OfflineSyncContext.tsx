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
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { connectivityMonitor, getConnectivityState } from '../offline-first/sync/ConnectivityMonitor';
import { syncEngine } from '../offline-first/sync/SyncEngine';
import { dataStore } from '../offline-first/store/DataStore';
import type { PendingSyncSummary } from '../services/offline/pendingOps';
import { ConfirmacaoSincronizarNuvemModal } from '../components/sismav/ConfirmacaoSincronizarNuvemModal';
import { OfflineStatusBanner } from '../components/sismav/OfflineStatusBanner';
import type { ConnectivityState } from '../offline-first/types';

type OfflineSyncContextType = {
  online: boolean;
  connectivity: ConnectivityState;
  pendingCount: number;
  pendingSummary: PendingSyncSummary;
  syncing: boolean;
  cloudUploading: boolean;
  openSyncPrompt: () => void;
};

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSummary, setPendingSummary] = useState<PendingSyncSummary>({
    total: 0,
    cadastros: 0,
    sessoes: 0,
    exclusoes: 0,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const autoSyncInFlightRef = useRef(false);

  const online = connectivity === 'ONLINE' || connectivity === 'DEGRADED' || connectivity === 'SYNCING';

  const refreshPending = useCallback(async () => {
    const uid = getCachedDataOwnerUid();
    if (!uid || !isAuthenticated) {
      setPendingCount(0);
      setPendingSummary({ total: 0, cadastros: 0, sessoes: 0, exclusoes: 0 });
      return;
    }
    const count = await dataStore.pendingCount(uid);
    setPendingCount(count);
    setPendingSummary({
      total: count,
      cadastros: count,
      sessoes: 0,
      exclusoes: 0,
    });
  }, [isAuthenticated]);

  const openSyncPrompt = useCallback(() => {
    if (pendingCount <= 0) return;
    setModalVisible(true);
  }, [pendingCount]);

  const autoSyncWithCloud = useCallback(async () => {
    if (!authReady || !isAuthenticated || !connectivityMonitor.canSync() || autoSyncInFlightRef.current) {
      return;
    }
    autoSyncInFlightRef.current = true;
    setSyncing(true);
    try {
      await syncEngine.scheduleProcess(true);
      await refreshPending();
    } finally {
      setSyncing(false);
      autoSyncInFlightRef.current = false;
    }
  }, [authReady, isAuthenticated, refreshPending]);

  useEffect(() => {
    connectivityMonitor.start();
    return connectivityMonitor.subscribe(setConnectivity);
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void refreshPending();
    return dataStore.subscribe(() => void refreshPending());
  }, [authReady, isAuthenticated, refreshPending]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !online) return;
    void autoSyncWithCloud();
  }, [authReady, isAuthenticated, online, connectivity, autoSyncWithCloud]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && connectivityMonitor.canSync()) {
        void autoSyncWithCloud();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [authReady, isAuthenticated, autoSyncWithCloud]);

  const confirmSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncEngine.forceSync();
      setModalVisible(false);
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  const dismissModal = useCallback(() => setModalVisible(false), []);

  const value = useMemo(
    () => ({
      online,
      connectivity,
      pendingCount,
      pendingSummary,
      syncing: syncing || connectivity === 'SYNCING',
      cloudUploading: connectivity === 'SYNCING',
      openSyncPrompt,
    }),
    [online, connectivity, pendingCount, pendingSummary, syncing, openSyncPrompt],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
      {isAuthenticated ? (
        <ConfirmacaoSincronizarNuvemModal
          visible={modalVisible}
          summary={pendingSummary}
          loading={syncing}
          onClose={dismissModal}
          onConfirm={() => void confirmSync()}
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
