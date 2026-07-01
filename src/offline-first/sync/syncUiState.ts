import type { SyncQueueBreakdown } from './syncQueueBreakdown';
import { EMPTY_SYNC_QUEUE_BREAKDOWN } from './syncQueueBreakdown';
import { createInitialSyncSteps, type SyncStepId, type SyncStepState } from './syncSteps';
import type { SyncErrorDetail } from './syncErrorInfo';

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
  uploadBreakdown: SyncQueueBreakdown;
  downloadBreakdown: SyncQueueBreakdown;
};

export type SyncDirectionPhase = 'preparing' | 'download' | 'upload' | 'finalize' | null;

export type CloudDiffWatchState = {
  /** Segundos restantes até a próxima comparação nuvem × local (null = inativo). */
  countdownSec: number | null;
  /** Mensagem temporária após a comparação (Ok sincronizado / clique em salvar…). */
  flashMessage: string | null;
};

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
  cloudDiffWatch: CloudDiffWatchState;
  syncMessage: string;
  lastSync: SyncResultSummary | null;
  lastSyncAt: number | null;
  syncError: string | null;
  syncErrorDetail: SyncErrorDetail | null;
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
  uploadBreakdown: EMPTY_SYNC_QUEUE_BREAKDOWN,
  downloadBreakdown: EMPTY_SYNC_QUEUE_BREAKDOWN,
};

export const EMPTY_CLOUD_DIFF_WATCH: CloudDiffWatchState = {
  countdownSec: null,
  flashMessage: null,
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
    cloudDiffWatch: { ...EMPTY_CLOUD_DIFF_WATCH },
    syncMessage: '',
    lastSync: null,
    lastSyncAt: null,
    syncError: null,
    syncErrorDetail: null,
    errorStepId: null,
    syncSteps: createInitialSyncSteps(),
    toggleEnabled: false,
  };
}
