import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import type { SyncReport } from '../offline-first/sync/syncReport';
import { RelatorioSincronizacaoModal } from '../components/sismav/RelatorioSincronizacaoModal';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';

type OfflineSyncContextType = {
  online: boolean;
  connectivity: ConnectivityState;
  appMode: SyncManagerState['mode'];
  /** @deprecated sempre false — UI usa IndexedDB */
  usingCloudData: boolean;
  /** @deprecated sempre false */
  usingSyncedSnapshot: boolean;
  pendingCount: number;
  pendingSummary: PendingSyncSummary;
  syncReport: SyncReport | null;
  syncing: boolean;
  syncModalVisible: boolean;
  uploadError: string | null;
  enterOnlineMode: () => Promise<{ ok: boolean; error?: string }>;
  confirmManualSync: () => Promise<void>;
  cancelOnlineMode: () => void;
  /** @deprecated use confirmManualSync */
  confirmSync: () => Promise<void>;
  dismissSync: () => void;
  openSyncModal: () => void;
};

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

function hasNetworkConnectivity(state: ConnectivityState = getConnectivityState()): boolean {
  return state === 'ONLINE' || state === 'DEGRADED' || state === 'SYNCING';
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { authReady } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [managerState, setManagerState] = useState<SyncManagerState>(getSyncManagerState);

  const online = hasNetworkConnectivity(connectivity);
  const pendingSummary = managerState.pendingSummary;
  const pendingCount = pendingSummary.total;

  const enterOnlineMode = useCallback(async () => {
    return syncManager.enterOnlineMode();
  }, []);

  const confirmManualSync = useCallback(async () => {
    await syncManager.confirmManualSync();
  }, []);

  const cancelOnlineMode = useCallback(() => {
    syncManager.cancelOnlineMode();
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
    return connectivityMonitor.subscribe(setConnectivity);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const ownerUid = getCachedDataOwnerUid();
    if (ownerUid) {
      void syncManager.bindSession(ownerUid);
    }
  }, [authReady]);

  const value = useMemo(
    () => ({
      online,
      connectivity,
      appMode: managerState.mode,
      usingCloudData: false,
      usingSyncedSnapshot: false,
      pendingCount,
      pendingSummary,
      syncReport: managerState.syncReport,
      syncing: managerState.uploading || connectivity === 'SYNCING',
      syncModalVisible: managerState.syncModalVisible,
      uploadError: managerState.uploadError,
      enterOnlineMode,
      confirmManualSync,
      cancelOnlineMode,
      confirmSync: confirmManualSync,
      dismissSync,
      openSyncModal,
    }),
    [
      online,
      connectivity,
      managerState.mode,
      managerState.syncReport,
      managerState.uploading,
      managerState.syncModalVisible,
      managerState.uploadError,
      pendingCount,
      pendingSummary,
      enterOnlineMode,
      confirmManualSync,
      cancelOnlineMode,
      dismissSync,
      openSyncModal,
    ],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
      <RelatorioSincronizacaoModal
        visible={managerState.syncModalVisible}
        report={managerState.syncReport}
        loading={managerState.uploading}
        errorMessage={managerState.uploadError}
        onClose={dismissSync}
        onConfirm={() => void confirmManualSync()}
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
