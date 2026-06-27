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
} from '../offline-first/sync/SyncManager';
import type { PendingSyncSummary } from '../offline-first/sync/pendingSyncItems';
import type { ConnectivityState } from '../offline-first/types';
import type { SyncUiState } from '../offline-first/sync/syncUiState';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { waitForAuthenticatedUid } from '../services/firebase/authUid';
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

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { authReady, signInWithGoogle, firebaseEnabled } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [managerState, setManagerState] = useState<SyncManagerState>(getSyncManagerState);

  const pendingSummary = managerState.pendingSummary;
  const pendingCount = pendingSummary.total;
  const syncUi = managerState.syncUi;

  const ensureAuthenticated = useCallback<EnsureAuthenticatedFn>(async () => {
    if (!firebaseEnabled) {
      return { ok: false, error: 'Configure o Firebase para sincronizar.' };
    }
    try {
      const existing = await waitForAuthenticatedUid(800);
      if (existing) return { ok: true };
      const redirect = await signInWithGoogle();
      if (redirect) {
        await waitForAuthenticatedUid(25_000);
      } else {
        await waitForAuthenticatedUid(20_000);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Falha no login Google.' };
    }
  }, [firebaseEnabled, signInWithGoogle]);

  useEffect(() => {
    syncManager.registerAuthHandler(ensureAuthenticated);
  }, [ensureAuthenticated]);

  const startSyncFromToggle = useCallback(async () => {
    return syncManager.startSyncFromToggle(ensureAuthenticated);
  }, [ensureAuthenticated]);

  const retrySync = useCallback(async () => {
    return syncManager.retrySync(ensureAuthenticated);
  }, [ensureAuthenticated]);

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

  useEffect(() => {
    if (!authReady) return;
    const ownerUid = getCachedDataOwnerUid();
    if (ownerUid) {
      void syncManager.bindSession(ownerUid);
    }
    void syncManager.refreshPending();
  }, [authReady]);

  const value = useMemo(
    () => ({
      connectivity,
      appMode: managerState.mode,
      online: !syncUi.isOffline,
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
