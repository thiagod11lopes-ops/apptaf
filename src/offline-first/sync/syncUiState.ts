export type SyncUiPhase = 'offline' | 'preparing' | 'syncing' | 'success' | 'error';

export type SyncProgressState = {
  percent: number;
  message: string;
  processed: number;
  total: number;
};

export type SyncResultSummary = {
  uploads: number;
  downloads: number;
  ignored: number;
  durationMs: number;
  finishedAt: number;
};

/** Estado global observado pela UI — sem acesso ao Firebase. */
export type SyncUiState = {
  phase: SyncUiPhase;
  isOffline: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgressState;
  pendingChanges: number;
  syncMessage: string;
  lastSync: SyncResultSummary | null;
  syncError: string | null;
  toggleEnabled: boolean;
};

export const EMPTY_SYNC_PROGRESS: SyncProgressState = {
  percent: 0,
  message: '',
  processed: 0,
  total: 0,
};

export function defaultSyncUiState(pendingChanges = 0): SyncUiState {
  return {
    phase: 'offline',
    isOffline: true,
    isOnline: false,
    isSyncing: false,
    syncProgress: { ...EMPTY_SYNC_PROGRESS },
    pendingChanges,
    syncMessage: '',
    lastSync: null,
    syncError: null,
    toggleEnabled: true,
  };
}
