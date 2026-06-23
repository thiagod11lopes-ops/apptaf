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
  openSyncPrompt: () => void;
};

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
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
  const wasOfflineRef = useRef(!isOnline());
  const modalDismissedRef = useRef(false);

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

  const tryPromptAfterReconnect = useCallback(async () => {
    if (!authReady || !isAuthenticated || !isOnline()) return;
    await refreshPending();
    const uid = getCachedDataOwnerUid();
    if (!uid) return;
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    const summary = summarizePendingOps(entry.pendingOps);
    if (summary.total > 0 && !modalDismissedRef.current) {
      setPendingSummary(summary);
      setModalVisible(true);
    }
  }, [authReady, isAuthenticated, refreshPending]);

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
    if (!authReady || !isAuthenticated) return;

    void refreshPending().then(() => {
      if (isOnline()) void tryPromptAfterReconnect();
    });

    const uid = getCachedDataOwnerUid();
    const unsubData = uid
      ? subscribeOfflineData(() => {
          void refreshPending();
        })
      : () => undefined;

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && isOnline()) {
        void tryPromptAfterReconnect();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      unsubData();
      sub.remove();
    };
  }, [authReady, isAuthenticated, refreshPending, tryPromptAfterReconnect]);

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

  const value = useMemo(
    () => ({
      online,
      pendingCount,
      pendingSummary,
      syncing,
      openSyncPrompt,
    }),
    [online, pendingCount, pendingSummary, syncing, openSyncPrompt],
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
