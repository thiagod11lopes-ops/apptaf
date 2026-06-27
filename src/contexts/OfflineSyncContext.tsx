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
  type EnsureAuthenticatedFn,
} from '../offline-first/sync/SyncManager';
import type { PendingSyncSummary } from '../offline-first/sync/pendingSyncItems';
import type { ConnectivityState } from '../offline-first/types';
import type { SyncUiState } from '../offline-first/sync/syncUiState';
import { getCachedDataOwnerUid, waitForAuthenticatedUid, waitForAuthUid } from '../services/firebase/authUid';
import { getFirebaseAuth } from '../config/firebase';
import { consumePendingSyncResume, hasPendingSyncResume, SYNC_RESUME_EVENT } from '../offline-first/sync/syncResume';
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
  const { authReady, signInWithGoogle, firebaseEnabled, isAuthenticated } = useAuth();
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [managerState, setManagerState] = useState<SyncManagerState>(getSyncManagerState);

  const pendingSummary = managerState.pendingSummary;
  const pendingCount = pendingSummary.total;
  const syncUi = managerState.syncUi;

  const ensureAuthenticated = useCallback<EnsureAuthenticatedFn>(async () => {
    if (!firebaseEnabled) {
      return { ok: false, error: 'Configure o Firebase para sincronizar.' };
    }
    if (!getFirebaseAuth()?.currentUser) {
      // Não confiar em UID persistido sem sessão Firebase ativa.
    } else {
      return { ok: true };
    }
    try {
      const isRedirect = await signInWithGoogle();
      if (isRedirect) {
        return { ok: false, error: SYNC_AUTH_REDIRECT };
      }

      await waitForAuthenticatedUid(20_000);
      if (!getFirebaseAuth()?.currentUser) {
        return { ok: false, error: 'Faça login com Google para sincronizar.' };
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

  const autoResumeInFlight = useRef(false);

  const tryAutoResumeSync = useCallback(async (): Promise<void> => {
    if (!firebaseEnabled) return;
    if (!hasPendingSyncResume()) return;
    if (autoResumeInFlight.current) return;
    if (syncManager.getSyncUi().isSyncing) return;

    autoResumeInFlight.current = true;
    try {
      if (!authReady) {
        await waitForAuthUid();
      }
      await waitForAuthenticatedUid(20_000);
      if (!getFirebaseAuth()?.currentUser) return;

      const ownerUid = getCachedDataOwnerUid();
      if (ownerUid) {
        await syncManager.bindSession(ownerUid);
      } else {
        await syncManager.refreshPending();
      }

      const result = await startSyncFromToggle();
      if (result.ok) {
        consumePendingSyncResume();
      }
    } finally {
      autoResumeInFlight.current = false;
    }
  }, [authReady, firebaseEnabled, startSyncFromToggle]);

  useEffect(() => {
    if (!authReady || !firebaseEnabled) return;
    const ownerUid = getCachedDataOwnerUid();
    if (ownerUid) {
      void syncManager.bindSession(ownerUid);
    } else {
      void syncManager.refreshPending();
    }
  }, [authReady, firebaseEnabled]);

  useEffect(() => {
    if (!authReady || !firebaseEnabled) return;
    if (!hasPendingSyncResume()) return;
    void tryAutoResumeSync();
  }, [authReady, firebaseEnabled, isAuthenticated, tryAutoResumeSync]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResume = () => {
      void tryAutoResumeSync();
    };
    window.addEventListener(SYNC_RESUME_EVENT, onResume);
    return () => window.removeEventListener(SYNC_RESUME_EVENT, onResume);
  }, [tryAutoResumeSync]);

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
