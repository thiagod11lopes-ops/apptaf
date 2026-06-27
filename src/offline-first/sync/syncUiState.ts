import type { SyncStepId, SyncStepState } from './syncSteps';
import { createInitialSyncSteps } from './syncSteps';

export type SyncUiPhase =
  | 'offline'
  | 'preparing'
  | 'syncing'
  | 'success'
  | 'already_up_to_date'
  | 'error';

export type SyncProgressState = {
  percent: number;
  message: string;
  processed: number;
  total: number;
  elapsedMs: number;
  remainingSeconds: number | null;
  recordsPerSecond: number;
};

export type SyncResultSummary = {
  uploads: number;
  downloads: number;
  ignored: number;
  durationMs: number;
  finishedAt: number;
  avgRecordsPerSecond: number;
  alreadyUpToDate?: boolean;
};

export type SyncCountersState = {
  pendingUploads: number;
  pendingDownloads: number | null;
  syncedTotal: number;
};

export type SyncDirectionPhase = 'preparing' | 'download' | 'upload' | 'finalize' | null;

/** Estado global observado pela UI — sem acesso ao Firebase. */
export type SyncUiState = {
  phase: SyncUiPhase;
  isAuthenticated: boolean;
  isBlocked: boolean;
  isOffline: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  /** @deprecated use downloadProgress / uploadProgress */
  syncProgress: SyncProgressState;
  downloadProgress: SyncProgressState;
  uploadProgress: SyncProgressState;
  activeSyncDirection: SyncDirectionPhase;
  counters: SyncCountersState;
  syncMessage: string;
  lastSync: SyncResultSummary | null;
  lastSyncAt: number | null;
  syncError: string | null;
  errorStepId: SyncStepId | null;
  syncSteps: SyncStepState[];
  toggleEnabled: boolean;
};

export const EMPTY_SYNC_PROGRESS: SyncProgressState = {
  percent: 0,
  message: '',
  processed: 0,
  total: 0,
  elapsedMs: 0,
  remainingSeconds: null,
  recordsPerSecond: 0,
};

export const EMPTY_COUNTERS: SyncCountersState = {
  pendingUploads: 0,
  pendingDownloads: null,
  syncedTotal: 0,
};

export function defaultSyncUiState(pendingUploads = 0): SyncUiState {
  return {
    phase: 'offline',
    isAuthenticated: false,
    isBlocked: true,
    isOffline: true,
    isOnline: false,
    isSyncing: false,
    syncProgress: { ...EMPTY_SYNC_PROGRESS },
    downloadProgress: { ...EMPTY_SYNC_PROGRESS },
    uploadProgress: { ...EMPTY_SYNC_PROGRESS },
    activeSyncDirection: null,
    counters: { ...EMPTY_COUNTERS, pendingUploads },
    syncMessage: '',
    lastSync: null,
    lastSyncAt: null,
    syncError: null,
    errorStepId: null,
    syncSteps: createInitialSyncSteps(),
    toggleEnabled: false,
  };
}
