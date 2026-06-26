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
import {
  syncManager,
  subscribeSyncManager,
  getSyncManagerState,
  type SyncManagerState,
} from '../offline-first/sync/SyncManager';
import type { PendingSyncSummary } from '../offline-first/sync/pendingSyncItems';
import type { ConnectivityState } from '../offline-first/types';
import { ConfirmacaoSincronizarNuvemModal } from '../components/sismav/ConfirmacaoSincronizarNuvemModal';

type OfflineSyncContextType = {
  online: boolean;
  connectivity: ConnectivityState;
  /** true = UI lê só dados synced da nuvem; false = lê IndexedDB local. */
  usingCloudData: boolean;
  pendingCount: number;
  pendingSummary: PendingSyncSummary;
  syncing: boolean;
  syncModalVisible: boolean;
  uploadError: string | null;
  confirmSync: () => Promise<void>;
  dismissSync: () => void;
  openSyncModal: () => void;
};

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

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
  const usingCloudData = managerState.mode === 'CLOUD_ACTIVE';

  const evaluateSession = useCallback(async () => {
    if (!authReady || !isAuthenticated) return;
    await syncManager.evaluateOnSessionStart();
  }, [authReady, isAuthenticated]);

  const confirmSync = useCallback(async () => {
    await syncManager.confirmUploadToCloud();
  }, []);

  const dismissSync = useCallback(() => {
    syncManager.dismissSyncModal();
  }, []);

  const openSyncModal = useCallback(() => {
    syncManager.openSyncModal();
  }, []);

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
      usingCloudData,
      pendingCount,
      pendingSummary,
      syncing: managerState.uploading || connectivity === 'SYNCING',
      syncModalVisible: managerState.syncModalVisible,
      uploadError: managerState.uploadError,
      confirmSync,
      dismissSync,
      openSyncModal,
    }),
    [
      online,
      connectivity,
      usingCloudData,
      pendingCount,
      pendingSummary,
      managerState.uploading,
      managerState.syncModalVisible,
      managerState.uploadError,
      confirmSync,
      dismissSync,
      openSyncModal,
    ],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
      <ConfirmacaoSincronizarNuvemModal
        visible={managerState.syncModalVisible}
        summary={pendingCount > 0 ? pendingSummary : null}
        loading={managerState.uploading}
        errorMessage={managerState.uploadError}
        onClose={dismissSync}
        onConfirm={() => void confirmSync()}
      />
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
