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
import { isOnline, subscribeOnlineStatus } from '../services/offline/networkStatus';
import {
  pushDeviceUpdatesToCloud,
  readOfflineCloudEntry,
  subscribeOfflineData,
} from '../services/offline/offlineCloudEngine';
import {
  startCloudFirestoreRealtime,
  stopCloudFirestoreRealtime,
} from '../services/offline/cloudFirestoreRealtime';
import {
  getCloudActivityState,
  subscribeCloudActivity,
} from '../services/offline/cloudSyncActivity';
import {
  summarizePendingOps,
  type PendingSyncSummary,
} from '../services/offline/pendingOps';
import { ConfirmacaoSincronizarNuvemModal } from '../components/sismav/ConfirmacaoSincronizarNuvemModal';
import { OfflineStatusBanner } from '../components/sismav/OfflineStatusBanner';

type OfflineSyncContextType = {
  online: boolean;
  pendingCount: number;
  pendingSummary: PendingSyncSummary;
  syncing: boolean;
  cloudUploading: boolean;
  openSyncPrompt: () => void;
};

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady, user, isAuthorizedMember } = useAuth();
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSummary, setPendingSummary] = useState<PendingSyncSummary>({
    total: 0,
    cadastros: 0,
    sessoes: 0,
    exclusoes: 0,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudUploading, setCloudUploading] = useState(false);
  const wasOfflineRef = useRef(!isOnline());
  const modalDismissedRef = useRef(false);
  const autoSyncInFlightRef = useRef(false);

  const refreshPending = useCallback(async () => {
    const uid = getCachedDataOwnerUid();
    if (!uid || !isAuthenticated) {
      setPendingCount(0);
      setPendingSummary({ total: 0, cadastros: 0, sessoes: 0, exclusoes: 0 });
      return;
    }
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    const summary = summarizePendingOps(entry.pendingOps);
    setPendingCount(summary.total);
    setPendingSummary(summary);
  }, [isAuthenticated]);

  const openSyncPrompt = useCallback(() => {
    if (pendingCount <= 0) return;
    modalDismissedRef.current = false;
    setModalVisible(true);
  }, [pendingCount]);

  const autoSyncWithCloud = useCallback(async () => {
    if (!authReady || !isAuthenticated || !isOnline() || autoSyncInFlightRef.current) return;
    const uid = getCachedDataOwnerUid();
    if (!uid) return;

    autoSyncInFlightRef.current = true;
    setSyncing(true);
    try {
      await pushDeviceUpdatesToCloud(uid);
      await refreshPending();
    } finally {
      setSyncing(false);
      autoSyncInFlightRef.current = false;
    }
  }, [authReady, isAuthenticated, refreshPending]);

  const tryPromptAfterReconnect = useCallback(async () => {
    if (!authReady || !isAuthenticated || !isOnline()) return;
    await autoSyncWithCloud();
  }, [authReady, isAuthenticated, autoSyncWithCloud]);

  useEffect(() => {
    return subscribeOnlineStatus((nextOnline) => {
      setOnline(nextOnline);
      if (nextOnline && wasOfflineRef.current) {
        wasOfflineRef.current = false;
        modalDismissedRef.current = false;
        void tryPromptAfterReconnect();
      }
      if (!nextOnline) {
        wasOfflineRef.current = true;
      }
    });
  }, [tryPromptAfterReconnect]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !online) {
      stopCloudFirestoreRealtime();
      return;
    }

    const uid = getCachedDataOwnerUid();
    if (!uid) {
      stopCloudFirestoreRealtime();
      return;
    }

    const stopRealtime = startCloudFirestoreRealtime(uid);

    void refreshPending().then(() => {
      if (isOnline()) void tryPromptAfterReconnect();
    });

    const unsubData = subscribeOfflineData(() => {
      void refreshPending();
    });

    const unsubActivity = subscribeCloudActivity((state) => {
      setCloudUploading(state.uploading);
    });

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && isOnline()) {
        void tryPromptAfterReconnect();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      stopRealtime();
      unsubData();
      unsubActivity();
      sub.remove();
    };
  }, [
    authReady,
    isAuthenticated,
    online,
    user?.uid,
    isAuthorizedMember,
    refreshPending,
    tryPromptAfterReconnect,
  ]);

  const confirmSync = useCallback(async () => {
    const uid = getCachedDataOwnerUid();
    if (!uid) return;
    setSyncing(true);
    try {
      await pushDeviceUpdatesToCloud(uid);
      modalDismissedRef.current = false;
      setModalVisible(false);
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  const dismissModal = useCallback(() => {
    modalDismissedRef.current = true;
    setModalVisible(false);
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !online) return;
    void autoSyncWithCloud();
  }, [authReady, isAuthenticated, online, autoSyncWithCloud]);

  const value = useMemo(
    () => ({
      online,
      pendingCount,
      pendingSummary,
      syncing,
      cloudUploading: cloudUploading || getCloudActivityState().uploading,
      openSyncPrompt,
    }),
    [online, pendingCount, pendingSummary, syncing, cloudUploading, openSyncPrompt],
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

/** Faixa global de status — visível apenas sem login Google (modo offline). */
export function OfflineSyncBanner() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return null;

  return (
    <OfflineStatusBanner
      offline
      pendingCount={0}
    />
  );
}

export function useOfflineSyncState(): OfflineSyncContextType {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSyncState deve ser usado dentro de OfflineSyncProvider');
  }
  return ctx;
}
