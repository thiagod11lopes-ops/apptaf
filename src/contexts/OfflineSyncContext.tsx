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
  type EnsureAuthenticatedFn,
  SYNC_AUTH_REQUIRED,
  SYNC_AUTH_REQUIRED_MESSAGE,
} from '../offline-first/sync/SyncManager';
import type { PendingSyncSummary } from '../offline-first/sync/pendingSyncItems';
import type { ConnectivityState } from '../offline-first/types';
import type { SyncUiState } from '../offline-first/sync/syncUiState';
import { getCachedDataOwnerUid, hydrateAuthUidFromIndexedDb } from '../services/firebase/authUid';
import { getFirebaseAuth } from '../config/firebase';
import { subscribeDataChanged } from '../offline-first/sync/SyncEngine';

type OfflineSyncContextType = {
  connectivity: ConnectivityState;
  appMode: SyncManagerState['mode'];
  /** @deprecated use syncUi */
  online: boolean;
  /** @deprecated sempre false */
  usingCloudData: boolean;
  /** @deprecated sempre false */
  usingSyncedSnapshot: boolean;
  pendingCount: number;
  pendingSummary: PendingSyncSummary;
  syncing: boolean;
  syncUi: SyncUiState;
  startSyncFromToggle: () => Promise<{ ok: boolean; error?: string }>;
  retrySync: () => Promise<{ ok: boolean; error?: string }>;
  /** @deprecated use startSyncFromToggle */
  enterOnlineMode: () => Promise<{ ok: boolean; error?: string }>;
  /** @deprecated */
  confirmManualSync: () => Promise<void>;
  cancelOnlineMode: () => void;
  dismissSync: () => void;
  openSyncModal: () => void;
  uploadError: string | null;
  syncReport: null;
  syncModalVisible: boolean;
  assistantProgress: null;
  clockDriftWarning: string | null;
  lastAudit: SyncManagerState['lastAudit'];
  confirmSync: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

/** Apenas verifica sessão Firebase ativa — nunca inicia login. */
const verifyAuthenticatedOnly: EnsureAuthenticatedFn = async () => {
  if (!getFirebaseAuth()?.currentUser) {
    return { ok: false, error: SYNC_AUTH_REQUIRED };
  }
  return { ok: true };
};

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { authReady, firebaseEnabled, isAuthenticated, user } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [managerState, setManagerState] = useState<SyncManagerState>(getSyncManagerState);

  const pendingSummary = managerState.pendingSummary;
  const pendingCount = pendingSummary.total;
  const syncUi = managerState.syncUi;

  useEffect(() => {
    if (!authReady || !firebaseEnabled) return;

    void (async () => {
      await hydrateAuthUidFromIndexedDb();
      const hasFirebaseUser = Boolean(getFirebaseAuth()?.currentUser);
      syncManager.setAuthAvailable(isAuthenticated && hasFirebaseUser);

      const ownerUid = getCachedDataOwnerUid();
      if (ownerUid) {
        await syncManager.bindSession(ownerUid);
      } else {
        await syncManager.refreshPending();
      }
    })();
  }, [authReady, firebaseEnabled, isAuthenticated, user?.uid]);

  const hasValidSession =
    authReady && isAuthenticated && Boolean(getFirebaseAuth()?.currentUser);

  useEffect(() => {
    syncManager.registerAuthHandler(verifyAuthenticatedOnly);
  }, []);

  const startSyncFromToggle = useCallback(async () => {
    if (!hasValidSession) {
      return { ok: false, error: SYNC_AUTH_REQUIRED_MESSAGE };
    }
    return syncManager.startSyncFromToggle(verifyAuthenticatedOnly);
  }, [hasValidSession]);

  const retrySync = useCallback(async () => {
    if (!hasValidSession) {
      return { ok: false, error: SYNC_AUTH_REQUIRED_MESSAGE };
    }
    return syncManager.retrySync(verifyAuthenticatedOnly);
  }, [hasValidSession]);

  const enterOnlineMode = startSyncFromToggle;

  const confirmManualSync = useCallback(async () => {
    await startSyncFromToggle();
  }, [startSyncFromToggle]);

  const cancelOnlineMode = useCallback(() => {
    syncManager.cancelOnlineMode();
  }, []);

  const dismissSync = useCallback(() => {
    syncManager.clearUploadError();
  }, []);

  const openSyncModal = useCallback(() => {}, []);

  useEffect(() => {
    return subscribeSyncManager(setManagerState);
  }, []);

  useEffect(() => {
    connectivityMonitor.start();
    return connectivityMonitor.subscribe(setConnectivity);
  }, []);

  useEffect(() => {
    return subscribeDataChanged(() => {
      void syncManager.refreshPending();
    });
  }, []);

  const value = useMemo(
    () => ({
      connectivity,
      appMode: managerState.mode,
      online: syncUi.isOnline,
      usingCloudData: false,
      usingSyncedSnapshot: false,
      pendingCount,
      pendingSummary,
      syncing: syncUi.isSyncing,
      syncUi,
      startSyncFromToggle,
      retrySync,
      enterOnlineMode,
      confirmManualSync,
      cancelOnlineMode,
      confirmSync: confirmManualSync,
      dismissSync,
      openSyncModal,
      uploadError: managerState.uploadError,
      syncReport: null,
      syncModalVisible: false,
      assistantProgress: null,
      clockDriftWarning: managerState.clockDriftWarning,
      lastAudit: managerState.lastAudit,
    }),
    [
      connectivity,
      managerState.mode,
      managerState.uploadError,
      managerState.clockDriftWarning,
      managerState.lastAudit,
      pendingCount,
      pendingSummary,
      syncUi,
      startSyncFromToggle,
      retrySync,
      enterOnlineMode,
      confirmManualSync,
      cancelOnlineMode,
      dismissSync,
      openSyncModal,
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
