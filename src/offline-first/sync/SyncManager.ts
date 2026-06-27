import { signOutFirebase } from '../../services/firebase/googleAuth';
import { getCachedDataOwnerUid, getCachedLoginUid } from '../../services/firebase/authUid';
import { getFirebaseAuth } from '../../config/firebase';
import { connectivityMonitor } from './ConnectivityMonitor';
import { getPendingSyncItems, type PendingSyncSummary } from './pendingSyncItems';
import { syncEngine } from './SyncEngine';
import { ANONYMOUS_OWNER } from '../db/localDb';
import { systemState } from './SystemState';
import { syncLogger } from './SyncLogger';
import { createLocalBackup, restoreLocalBackup } from './localBackup';
import { detectClockDrift, type ClockDriftResult } from './clockDrift';
import { prepareSyncSession } from './syncSessionPrepare';
import { probeFirestoreConnectivity } from './firebase/FirebaseGateway';
import type { SyncAuditEntry } from './syncAudit';
import {
  type SyncProgressState,
  type SyncResultSummary,
  type SyncUiPhase,
  type SyncUiState,
} from './syncUiState';

export type SyncManagerMode = 'OFFLINE' | 'ONLINE_PREPARING' | 'ONLINE_SYNCING';

export type EnsureAuthenticatedFn = () => Promise<{ ok: boolean; error?: string }>;

export type SyncManagerState = {
  mode: SyncManagerMode;
  pendingSummary: PendingSyncSummary;
  uploadError: string | null;
  lastAudit: SyncAuditEntry | null;
  syncUi: SyncUiState;
  /** @deprecated modais removidos — sync via chave na Home */
  syncReport: null;
  uploading: boolean;
  syncModalVisible: boolean;
  assistantProgress: null;
  clockDriftWarning: string | null;
};

export function formatSyncUploadError(raw?: string | null): string {
  if (!raw?.trim()) {
    return 'Falha ao sincronizar com a nuvem. Tente novamente.';
  }
  const msg = raw.trim();
  if (msg === 'offline') {
    return 'Sem conexão com a internet. Verifique a rede e tente novamente.';
  }
  if (msg === 'upload_failed' || msg === 'upload_incomplete' || msg === 'pending_remain') {
    return 'Não foi possível enviar os dados locais. Tente novamente.';
  }
  if (msg === 'no_owner') {
    return 'Sessão inválida. Entre novamente com Google.';
  }
  if (/permission|permiss[aã]o|denied|insufficient/i.test(msg)) {
    return 'Permissão negada na nuvem. Verifique sua conta.';
  }
  return msg;
}

const EMPTY_SUMMARY: PendingSyncSummary = {
  items: [],
  total: 0,
  cadastros: 0,
  sessoes: 0,
  aplicadores: 0,
};

const PREPARE_WEIGHT = 45;
const SYNC_WEIGHT = 50;
const FINAL_WEIGHT = 5;

type Listener = (state: SyncManagerState) => void;

let ownerUid: string | null = null;
let mode: SyncManagerMode = 'OFFLINE';
let pendingSummary: PendingSyncSummary = EMPTY_SUMMARY;
let uploading = false;
let uploadError: string | null = null;
let syncInFlight = false;
let lastAudit: SyncAuditEntry | null = null;
let clockDriftResult: ClockDriftResult | null = null;
let backupIdBeforeSync: number | null = null;
let uiPhase: SyncUiPhase = 'offline';
let syncProgress: SyncProgressState = { percent: 0, message: '', processed: 0, total: 0 };
let syncMessage = '';
let lastSyncResult: SyncResultSummary | null = null;
let successTimer: ReturnType<typeof setTimeout> | null = null;
let storedEnsureAuth: EnsureAuthenticatedFn | null = null;
const listeners = new Set<Listener>();

function buildSyncUi(): SyncUiState {
  const pending = pendingSummary.total;
  const isSyncing = uiPhase === 'preparing' || uiPhase === 'syncing' || uploading;
  const isOffline = uiPhase === 'offline' && !isSyncing;
  const isOnline = uiPhase === 'preparing' || uiPhase === 'syncing' || uiPhase === 'success';
  const toggleEnabled = !isSyncing && uiPhase !== 'success';

  return {
    phase: uiPhase,
    isOffline,
    isOnline,
    isSyncing,
    syncProgress,
    pendingChanges: pending,
    syncMessage: syncMessage || syncProgress.message,
    lastSync: lastSyncResult,
    syncError: uiPhase === 'error' ? uploadError : null,
    toggleEnabled,
  };
}

function snapshot(): SyncManagerState {
  return {
    mode,
    pendingSummary,
    uploadError,
    lastAudit,
    syncUi: buildSyncUi(),
    syncReport: null,
    uploading,
    syncModalVisible: false,
    assistantProgress: null,
    clockDriftWarning: clockDriftResult?.warningMessage ?? null,
  };
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn(snapshot()));
}

function setUiProgress(percent: number, message: string, processed = 0, total = 0): void {
  syncProgress = {
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    message,
    processed,
    total,
  };
  syncMessage = message;
  notifyListeners();
}

function setPhase(phase: SyncUiPhase): void {
  uiPhase = phase;
  notifyListeners();
}

async function refreshPendingSummary(): Promise<PendingSyncSummary> {
  const uid = ownerUid ?? getCachedDataOwnerUid() ?? ANONYMOUS_OWNER;
  ownerUid = uid !== ANONYMOUS_OWNER ? uid : ownerUid;
  await syncEngine.preparePendingOwner(uid);
  pendingSummary = await getPendingSyncItems(uid);
  return pendingSummary;
}

async function returnToOfflineMode(): Promise<void> {
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
  syncEngine.deactivateOnlineMode();
  await syncEngine.shutdownSession();
  await systemState.setOfflineMode();
  mode = 'OFFLINE';
  uploading = false;
  uploadError = null;
  backupIdBeforeSync = null;
  clockDriftResult = null;
  syncProgress = { percent: 0, message: '', processed: 0, total: 0 };
  syncMessage = '';
  uiPhase = 'offline';
  await refreshPendingSummary();
  notifyListeners();
}

function mapLwwProgressToPercent(processed: number, total: number): number {
  if (total <= 0) return PREPARE_WEIGHT + SYNC_WEIGHT;
  return PREPARE_WEIGHT + (processed / total) * SYNC_WEIGHT;
}

async function runSyncPipeline(ensureAuth: EnsureAuthenticatedFn): Promise<{ ok: boolean; error?: string }> {
  if (syncInFlight) return { ok: false, error: 'sync_in_progress' };

  syncInFlight = true;
  uploading = true;
  uploadError = null;
  mode = 'ONLINE_PREPARING';
  uiPhase = 'preparing';
  setUiProgress(2, 'Verificando conexão…');

  const startedAt = Date.now();

  try {
    setUiProgress(5, 'Verificando conexão com a internet…');
    await connectivityMonitor.refresh();
    const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!browserOnline || !connectivityMonitor.canSync()) {
      throw new Error('offline');
    }

    setUiProgress(10, 'Autenticando com Google…');
    const authResult = await ensureAuth();
    if (!authResult.ok) {
      throw new Error(authResult.error ?? 'Faça login com Google para sincronizar.');
    }

    const loginUid = getCachedLoginUid();
    if (!loginUid) {
      throw new Error('Faça login com Google para sincronizar.');
    }

    setUiProgress(15, 'Confirmando sessão Google…');
    const authUser = getFirebaseAuth()?.currentUser;
    if (!authUser) {
      throw new Error('Faça login com Google para sincronizar.');
    }

    await systemState.setOnlineMode();

    setUiProgress(22, 'Validando permissões…');
    const session = await prepareSyncSession(loginUid, authUser.email);
    ownerUid = session.dataOwnerUid;
    syncEngine.bindOwner(ownerUid);
    await syncEngine.init(ownerUid);

    setUiProgress(30, 'Conectando ao Firebase…');
    const firestoreOk = await probeFirestoreConnectivity();
    if (!firestoreOk) {
      throw new Error('Não foi possível conectar ao Firebase. Tente novamente.');
    }

    setUiProgress(35, 'Criando backup local…');
    backupIdBeforeSync = await createLocalBackup(ownerUid);

    setUiProgress(40, 'Verificando horário do sistema…');
    clockDriftResult = await detectClockDrift();

    setUiProgress(PREPARE_WEIGHT, 'Iniciando sincronização…');
    mode = 'ONLINE_SYNCING';
    uiPhase = 'syncing';
    setUiProgress(PREPARE_WEIGHT, 'Sincronizando…');

    const result = await syncEngine.runLastWriteWinsSync({
      backupId: backupIdBeforeSync,
      clockDrift: clockDriftResult ?? undefined,
      userEmail: authUser.email ?? null,
      onProgress: ({ processed, total, message }) => {
        const pct = mapLwwProgressToPercent(processed, total);
        setUiProgress(pct, message, processed, total);
      },
    });

    lastAudit = result.audit;

    if (!result.success) {
      if (backupIdBeforeSync != null) {
        setUiProgress(50, 'Restaurando backup local…');
        await restoreLocalBackup(backupIdBeforeSync);
      }
      throw new Error(result.stats.errors[0] ?? 'upload_failed');
    }

    setUiProgress(PREPARE_WEIGHT + SYNC_WEIGHT + 2, 'Finalizando…');
    await refreshPendingSummary();

    const durationMs = Date.now() - startedAt;
    lastSyncResult = {
      uploads: result.stats.uploads,
      downloads: result.stats.downloads,
      ignored: result.stats.ignored,
      durationMs,
      finishedAt: Date.now(),
    };

    uiPhase = 'success';
    setUiProgress(100, 'Sincronização concluída', result.stats.uploads + result.stats.downloads + result.stats.ignored, result.stats.uploads + result.stats.downloads + result.stats.ignored);

    await syncLogger.info(
      'sync-manager',
      `Sync concluída em ${durationMs}ms: ↑${result.stats.uploads} ↓${result.stats.downloads} ⊘${result.stats.ignored}`,
    );

    successTimer = setTimeout(() => {
      void (async () => {
        try {
          await signOutFirebase();
        } catch {
          // mantém sessão local
        }
        await returnToOfflineMode();
      })();
    }, 2000);

    return { ok: true };
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);
    uploadError = formatSyncUploadError(rawError);
    uiPhase = 'error';
    syncMessage = uploadError;
    mode = 'OFFLINE';
    await syncLogger.error('sync-manager', rawError);
    try {
      await signOutFirebase();
    } catch {
      // ignore
    }
    await systemState.setOfflineMode();
    syncEngine.deactivateOnlineMode();
    await syncEngine.shutdownSession();
    await refreshPendingSummary();
    notifyListeners();
    return { ok: false, error: uploadError };
  } finally {
    uploading = false;
    syncInFlight = false;
    notifyListeners();
  }
}

export function isCloudReadActive(): boolean {
  return false;
}

export function isSyncedDisplayActive(): boolean {
  return false;
}

export function getSyncManagerState(): SyncManagerState {
  return snapshot();
}

export function subscribeSyncManager(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export const syncManager = {
  registerAuthHandler(fn: EnsureAuthenticatedFn): void {
    storedEnsureAuth = fn;
  },

  async bindSession(dataOwnerUid: string): Promise<void> {
    ownerUid = dataOwnerUid;
    syncEngine.bindOwner(dataOwnerUid);
    await systemState.hydrate();
    await systemState.setOfflineMode();
    connectivityMonitor.start();
    syncEngine.deactivateOnlineMode();
    mode = 'OFFLINE';
    uiPhase = 'offline';
    await refreshPendingSummary();
    notifyListeners();
  },

  async evaluateOnSessionStart(): Promise<void> {
    ownerUid = getCachedDataOwnerUid();
    if (!ownerUid) return;
    await this.bindSession(ownerUid);
  },

  async evaluateOnReconnect(): Promise<void> {
    await refreshPendingSummary();
    notifyListeners();
  },

  onDisconnect(): void {
    if (mode === 'OFFLINE' && uiPhase === 'offline') return;
    if (syncInFlight) return;
    void returnToOfflineMode();
  },

  /** Liga a chave na Home — fluxo completo sem modais. */
  async startSyncFromToggle(ensureAuth?: EnsureAuthenticatedFn): Promise<{ ok: boolean; error?: string }> {
    const authFn = ensureAuth ?? storedEnsureAuth;
    if (!authFn) {
      return { ok: false, error: 'Autenticação indisponível.' };
    }
    return runSyncPipeline(authFn);
  },

  async retrySync(ensureAuth?: EnsureAuthenticatedFn): Promise<{ ok: boolean; error?: string }> {
    uploadError = null;
    uiPhase = 'offline';
    notifyListeners();
    return this.startSyncFromToggle(ensureAuth);
  },

  /** @deprecated use startSyncFromToggle */
  async enterOnlineMode(): Promise<{ ok: boolean; error?: string }> {
    return this.startSyncFromToggle();
  },

  /** @deprecated sync automático via chave */
  async confirmManualSync(): Promise<void> {
    await this.startSyncFromToggle();
  },

  cancelOnlineMode(): void {
    if (syncInFlight) return;
    void returnToOfflineMode();
  },

  dismissSyncModal(): void {
    void returnToOfflineMode();
  },

  clearUploadError(): void {
    uploadError = null;
    if (uiPhase === 'error') uiPhase = 'offline';
    notifyListeners();
  },

  openSyncModal(): void {},

  scheduleOnlineWriteFlush(): void {},

  async refreshPending(): Promise<PendingSyncSummary> {
    const summary = await refreshPendingSummary();
    notifyListeners();
    return summary;
  },

  async shutdown(): Promise<void> {
    await returnToOfflineMode();
    ownerUid = null;
    pendingSummary = EMPTY_SUMMARY;
  },

  isCloudReadActive,
  isSyncedDisplayActive,
  getMode(): SyncManagerMode {
    return mode;
  },

  getSyncUi(): SyncUiState {
    return buildSyncUi();
  },
};
