import { getCachedDataOwnerUid, getCachedLoginUid } from '../../services/firebase/authUid';
import { getFirebaseAuth } from '../../config/firebase';
import { connectivityMonitor } from './ConnectivityMonitor';
import { getPendingSyncItems, type PendingSyncSummary } from './pendingSyncItems';
import { syncEngine, notifyDataChanged } from './SyncEngine';
import { ANONYMOUS_OWNER } from '../db/localDb';
import { systemState } from './SystemState';
import { syncLogger } from './SyncLogger';
import { createLocalBackup, restoreLocalBackup } from './localBackup';
import { detectClockDrift, type ClockDriftResult } from './clockDrift';
import { prepareSyncSession } from './syncSessionPrepare';
import { registerAuthorizedMemberLogin } from './firebase/FirebaseGateway';
import { probeFirestoreConnectivityDetailed } from './firebase/FirebaseGateway';
import type { SyncAuditEntry } from './syncAudit';
import { buildSyncCounters, getLastSyncTimestamp } from './syncCounters';
import type { SyncCountersState } from './syncUiState';
import {
  advanceStep,
  createInitialSyncSteps,
  markStepError,
  markStepsDoneThrough,
  type SyncStepId,
  type SyncStepState,
} from './syncSteps';
import {
  type SyncProgressState,
  type SyncResultSummary,
  type SyncUiPhase,
  type SyncUiState,
  type SyncDirectionPhase,
  EMPTY_SYNC_PROGRESS,
} from './syncUiState';
import { estimateSyncQueueCounts } from './lastWriteWinsSync';

export type SyncManagerMode = 'OFFLINE' | 'ONLINE_PREPARING' | 'ONLINE_SYNCING';

export type EnsureAuthenticatedFn = () => Promise<{ ok: boolean; error?: string }>;

/** Erro interno quando sync é solicitado sem sessão Google ativa. */
export const SYNC_AUTH_REQUIRED = 'AUTH_REQUIRED';

export const SYNC_AUTH_REQUIRED_MESSAGE =
  'Faça login com Google antes de ativar sincronização';

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
  if (/^pending_remain:\d+/.test(msg)) {
    const count = msg.split(':')[1] ?? '0';
    return `${count} alteração(ões) local(is) não foram sincronizadas. Verifique o login e tente novamente.`;
  }
  if (msg === 'no_owner') {
    return 'Sessão inválida. Entre novamente com Google.';
  }
  if (msg === SYNC_AUTH_REQUIRED || msg === SYNC_AUTH_REQUIRED_MESSAGE) {
    return SYNC_AUTH_REQUIRED_MESSAGE;
  }
  if (msg === 'Faça login com Google para sincronizar.') {
    return SYNC_AUTH_REQUIRED_MESSAGE;
  }
  if (/permission|permiss[aã]o|denied|insufficient/i.test(msg)) {
    if (
      /pre_cadastros|Publique as regras|Permissão negada na coleção|Permissão negada ao ler/i.test(
        msg,
      )
    ) {
      return msg;
    }
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
  pre_cadastros: 0,
};

const SUCCESS_DISPLAY_MS = 3000;
const ALREADY_UP_TO_DATE_MS = 2000;

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
let syncProgress: SyncProgressState = { ...EMPTY_SYNC_PROGRESS };
let downloadProgress: SyncProgressState = { ...EMPTY_SYNC_PROGRESS };
let uploadProgress: SyncProgressState = { ...EMPTY_SYNC_PROGRESS };
let activeSyncDirection: SyncDirectionPhase = null;
let syncMessage = '';
let lastSyncResult: SyncResultSummary | null = null;
let lastSyncAt: number | null = null;
let syncSteps: SyncStepState[] = createInitialSyncSteps();
let errorStepId: SyncStepId | null = null;
let counters: SyncCountersState = { pendingUploads: 0, pendingDownloads: null, syncedTotal: 0 };
let successTimer: ReturnType<typeof setTimeout> | null = null;
let etaTimer: ReturnType<typeof setInterval> | null = null;
let syncStartedAt = 0;
let recordSyncStartedAt = 0;
let storedEnsureAuth: EnsureAuthenticatedFn | null = null;
let syncAuthAvailable = false;
let queueEstimateInFlight = false;
let queueEstimateTimer: ReturnType<typeof setTimeout> | null = null;
let cloudDiffWatchTimer: ReturnType<typeof setInterval> | null = null;
let cloudDiffFlashTimer: ReturnType<typeof setTimeout> | null = null;
let cloudDiffCountdownSec = 45;
let cloudDiffFlashMessage: string | null = null;
let cloudDiffCompareInFlight = false;
export const CLOUD_DIFF_COUNTDOWN_SEC = 45;
const CLOUD_DIFF_FLASH_SYNCED_MS = 2000;
const CLOUD_DIFF_FLASH_NEEDS_SYNC_MS = 10_000;
const listeners = new Set<Listener>();

function buildCloudDiffWatch(): { countdownSec: number | null; flashMessage: string | null } {
  const watchEligible = syncAuthAvailable && mode === 'OFFLINE' && !syncInFlight;
  return {
    countdownSec:
      watchEligible && !cloudDiffFlashMessage && !cloudDiffCompareInFlight
        ? cloudDiffCountdownSec
        : null,
    flashMessage: watchEligible ? cloudDiffFlashMessage : null,
  };
}

function buildSyncUi(): SyncUiState {
  const isAuthenticated = syncAuthAvailable;
  const isBlocked = !isAuthenticated;
  const isSyncing = uiPhase === 'preparing' || uiPhase === 'syncing' || uploading;
  const isOffline =
    uiPhase === 'offline' || uiPhase === 'error' || (uiPhase === 'success' && !isSyncing);
  const isOnline =
    isAuthenticated &&
    (uiPhase === 'preparing' ||
      uiPhase === 'syncing' ||
      uiPhase === 'success' ||
      uiPhase === 'already_up_to_date');
  const toggleEnabled =
    isAuthenticated && !isSyncing && uiPhase !== 'success' && uiPhase !== 'already_up_to_date';

  return {
    phase: uiPhase,
    isAuthenticated,
    isBlocked,
    isOffline,
    isOnline,
    isSyncing,
    syncProgress,
    downloadProgress,
    uploadProgress,
    activeSyncDirection,
    counters,
    cloudDiffWatch: buildCloudDiffWatch(),
    syncMessage: syncMessage || syncProgress.message,
    lastSync: lastSyncResult,
    lastSyncAt,
    syncError: uiPhase === 'error' ? uploadError : null,
    errorStepId,
    syncSteps,
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

function stopEtaTimer(): void {
  if (etaTimer) {
    clearInterval(etaTimer);
    etaTimer = null;
  }
}

function startEtaTimer(): void {
  stopEtaTimer();
  etaTimer = setInterval(() => {
    if (!syncInFlight) return;
    const elapsedMs = Date.now() - syncStartedAt;
    const { processed, total } = syncProgress;
    let recordsPerSecond = 0;
    let remainingSeconds: number | null = null;

    if (recordSyncStartedAt > 0 && processed > 0) {
      const recordElapsedSec = (Date.now() - recordSyncStartedAt) / 1000;
      recordsPerSecond = processed / Math.max(recordElapsedSec, 0.1);
      if (total > processed && recordsPerSecond > 0) {
        remainingSeconds = (total - processed) / recordsPerSecond;
      }
    }

    syncProgress = { ...syncProgress, elapsedMs, remainingSeconds, recordsPerSecond };
    notifyListeners();
  }, 500);
}

function setActiveStep(stepId: SyncStepId): void {
  syncSteps = advanceStep(syncSteps, stepId);
  notifyListeners();
}

function completeStep(stepId: SyncStepId): void {
  syncSteps = markStepsDoneThrough(syncSteps, stepId);
  notifyListeners();
}

function setDirectionProgress(
  direction: SyncDirectionPhase,
  percent: number,
  message: string,
  processed = 0,
  total = 0,
): void {
  activeSyncDirection = direction;
  const next: SyncProgressState = {
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    message,
    processed,
    total,
    elapsedMs: syncStartedAt ? Date.now() - syncStartedAt : 0,
    remainingSeconds: null,
    recordsPerSecond: 0,
  };
  syncProgress = next;
  if (direction === 'download') {
    downloadProgress = next;
  } else if (direction === 'upload') {
    uploadProgress = next;
  }
  syncMessage = message;
  notifyListeners();
}

function setUiProgress(
  percent: number,
  message: string,
  processed = 0,
  total = 0,
  opts?: Partial<Pick<SyncProgressState, 'remainingSeconds' | 'recordsPerSecond'>>,
  direction: SyncDirectionPhase = activeSyncDirection,
): void {
  if (direction === 'download' || direction === 'upload') {
    setDirectionProgress(direction, percent, message, processed, total);
    return;
  }

  activeSyncDirection = direction;
  syncProgress = {
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    message,
    processed,
    total,
    elapsedMs: syncStartedAt ? Date.now() - syncStartedAt : 0,
    remainingSeconds: opts?.remainingSeconds ?? syncProgress.remainingSeconds,
    recordsPerSecond: opts?.recordsPerSecond ?? syncProgress.recordsPerSecond,
  };
  syncMessage = message;
  notifyListeners();
}

function setPhase(phase: SyncUiPhase): void {
  uiPhase = phase;
  notifyListeners();
}

async function ensureMemberCloudAccess(): Promise<void> {
  const loginUid = getCachedLoginUid();
  const ownerUid = getCachedDataOwnerUid();
  const email = getFirebaseAuth()?.currentUser?.email;
  if (!loginUid || !ownerUid || loginUid === ownerUid || !email?.trim()) return;
  await getFirebaseAuth()?.currentUser?.getIdToken(true);
  await registerAuthorizedMemberLogin(ownerUid, email, loginUid);
}

function isCloudPermissionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /permission|permiss[aã]o|denied|insufficient/i.test(msg);
}

async function refreshCloudQueueEstimate(force = false, attempt = 0): Promise<void> {
  const uid = ownerUid ?? getCachedDataOwnerUid() ?? ANONYMOUS_OWNER;
  if (uid === ANONYMOUS_OWNER || !syncAuthAvailable || syncInFlight) return;
  if (!connectivityMonitor.canSync()) return;
  if (queueEstimateInFlight && !force && attempt === 0) return;
  if (!getFirebaseAuth()?.currentUser) return;

  queueEstimateInFlight = true;
  try {
    await ensureMemberCloudAccess();
    syncEngine.bindOwner(uid);
    const estimate = await estimateSyncQueueCounts(uid, force);
    if (syncInFlight) return;
    counters = {
      ...counters,
      pendingUploads: pendingSummary.total,
      pendingDownloads: estimate.pendingDownloads,
    };
    notifyListeners();
  } catch (error) {
    if (attempt < 2 && isCloudPermissionError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      return refreshCloudQueueEstimate(force, attempt + 1);
    }
    await syncLogger.warn(
      'sync-manager',
      `Estimativa nuvem falhou: ${error instanceof Error ? error.message : String(error)}`,
    );
    counters = {
      ...counters,
      pendingUploads: Math.max(counters.pendingUploads, pendingSummary.total),
    };
    notifyListeners();
    scheduleCloudQueueEstimate();
  } finally {
    queueEstimateInFlight = false;
  }
}

function scheduleCloudQueueEstimate(): void {
  if (queueEstimateTimer) clearTimeout(queueEstimateTimer);
  queueEstimateTimer = setTimeout(() => {
    queueEstimateTimer = null;
    void refreshCloudQueueEstimate();
  }, 1200);
}

function stopCloudDiffWatch(): void {
  if (cloudDiffWatchTimer) {
    clearInterval(cloudDiffWatchTimer);
    cloudDiffWatchTimer = null;
  }
  if (cloudDiffFlashTimer) {
    clearTimeout(cloudDiffFlashTimer);
    cloudDiffFlashTimer = null;
  }
  cloudDiffFlashMessage = null;
  cloudDiffCompareInFlight = false;
  cloudDiffCountdownSec = CLOUD_DIFF_COUNTDOWN_SEC;
}

function showCloudDiffFlash(message: string, durationMs: number): void {
  cloudDiffFlashMessage = message;
  notifyListeners();
  if (cloudDiffFlashTimer) clearTimeout(cloudDiffFlashTimer);
  cloudDiffFlashTimer = setTimeout(() => {
    cloudDiffFlashMessage = null;
    cloudDiffFlashTimer = null;
    cloudDiffCountdownSec = CLOUD_DIFF_COUNTDOWN_SEC;
    notifyListeners();
  }, durationMs);
}

async function runCloudDiffCycle(): Promise<void> {
  if (cloudDiffCompareInFlight || !syncAuthAvailable || syncInFlight) return;
  cloudDiffCompareInFlight = true;
  notifyListeners();
  try {
    await refreshCloudQueueEstimate(true);
    const pending =
      (counters.pendingUploads ?? 0) + (counters.pendingDownloads ?? 0);
    if (pending === 0) {
      showCloudDiffFlash('Ok sincronizado', CLOUD_DIFF_FLASH_SYNCED_MS);
    } else {
      showCloudDiffFlash('clique em salvar para sincronizar', CLOUD_DIFF_FLASH_NEEDS_SYNC_MS);
    }
  } catch {
    showCloudDiffFlash('clique em salvar para sincronizar', CLOUD_DIFF_FLASH_NEEDS_SYNC_MS);
  } finally {
    cloudDiffCompareInFlight = false;
    notifyListeners();
  }
}

function tickCloudDiffCountdown(): void {
  if (!syncAuthAvailable || syncInFlight || mode !== 'OFFLINE') return;
  if (cloudDiffFlashMessage || cloudDiffCompareInFlight) return;

  if (!connectivityMonitor.canSync()) {
    if (cloudDiffCountdownSec !== CLOUD_DIFF_COUNTDOWN_SEC) {
      cloudDiffCountdownSec = CLOUD_DIFF_COUNTDOWN_SEC;
      notifyListeners();
    }
    return;
  }

  cloudDiffCountdownSec -= 1;
  if (cloudDiffCountdownSec <= 0) {
    cloudDiffCountdownSec = 0;
    notifyListeners();
    void runCloudDiffCycle();
    return;
  }
  notifyListeners();
}

/** Cronômetro regressivo + comparação IndexedDB × nuvem enquanto logado e offline. */
function startCloudDiffWatch(): void {
  stopCloudDiffWatch();
  if (!syncAuthAvailable) return;
  cloudDiffCountdownSec = CLOUD_DIFF_COUNTDOWN_SEC;
  void refreshCloudQueueEstimate(true);
  cloudDiffWatchTimer = setInterval(tickCloudDiffCountdown, 1000);
  notifyListeners();
}

async function refreshCounters(pendingDownloads: number | null = counters.pendingDownloads): Promise<void> {
  const uid = ownerUid ?? getCachedDataOwnerUid() ?? ANONYMOUS_OWNER;
  if (uid === ANONYMOUS_OWNER) return;
  counters = await buildSyncCounters(uid, pendingSummary.total, pendingDownloads);
  notifyListeners();
}

async function applyCountersAfterSuccessfulSync(): Promise<void> {
  const uid = ownerUid ?? getCachedDataOwnerUid();
  if (!uid) return;
  await refreshPendingSummary();
  counters = await buildSyncCounters(
    uid,
    pendingSummary.total,
    pendingSummary.total === 0 ? 0 : counters.pendingDownloads,
  );
  notifyListeners();
}

async function refreshPendingSummary(): Promise<PendingSyncSummary> {
  const uid = ownerUid ?? getCachedDataOwnerUid() ?? ANONYMOUS_OWNER;
  ownerUid = uid !== ANONYMOUS_OWNER ? uid : ownerUid;
  await syncEngine.preparePendingOwner(uid);
  pendingSummary = await getPendingSyncItems(uid);
  await refreshCounters(counters.pendingDownloads);
  return pendingSummary;
}

async function loadLastSyncFromAudit(): Promise<void> {
  const uid = ownerUid ?? getCachedDataOwnerUid();
  if (!uid) return;
  lastSyncAt = await getLastSyncTimestamp(uid);
}

async function returnToOfflineMode(): Promise<void> {
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
  stopEtaTimer();
  syncEngine.deactivateOnlineMode();
  await syncEngine.shutdownSession();
  await systemState.setOfflineMode();
  mode = 'OFFLINE';
  uploading = false;
  uploadError = null;
  backupIdBeforeSync = null;
  clockDriftResult = null;
  syncProgress = { ...EMPTY_SYNC_PROGRESS };
  downloadProgress = { ...EMPTY_SYNC_PROGRESS };
  uploadProgress = { ...EMPTY_SYNC_PROGRESS };
  activeSyncDirection = null;
  syncMessage = '';
  syncSteps = createInitialSyncSteps();
  errorStepId = null;
  uiPhase = 'offline';
  await refreshPendingSummary();
  if (pendingSummary.total === 0) {
    const uid = ownerUid ?? getCachedDataOwnerUid();
    if (uid) {
      counters = await buildSyncCounters(uid, 0, 0);
    }
  }
  if (syncAuthAvailable) {
    scheduleCloudQueueEstimate();
  } else {
    counters = { ...counters, pendingDownloads: null };
  }
  notifyListeners();
}

function scheduleReturnToOffline(delayMs: number): void {
  successTimer = setTimeout(() => {
    void returnToOfflineMode();
  }, delayMs);
}

async function runSyncPipeline(ensureAuth: EnsureAuthenticatedFn): Promise<{ ok: boolean; error?: string }> {
  if (syncInFlight) return { ok: false, error: 'sync_in_progress' };

  let queueEstimateWaitMs = 0;
  while (queueEstimateInFlight) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    queueEstimateWaitMs += 100;
    if (queueEstimateWaitMs >= 90_000) break;
  }

  syncInFlight = true;
  uploading = true;
  uploadError = null;
  errorStepId = null;
  mode = 'ONLINE_PREPARING';
  uiPhase = 'preparing';
  syncSteps = createInitialSyncSteps();
  syncStartedAt = Date.now();
  recordSyncStartedAt = 0;
  syncProgress = { ...EMPTY_SYNC_PROGRESS };
  downloadProgress = { ...EMPTY_SYNC_PROGRESS };
  uploadProgress = { ...EMPTY_SYNC_PROGRESS };
  activeSyncDirection = 'preparing';
  startEtaTimer();

  const startedAt = Date.now();
  let currentStep: SyncStepId = 'login_google';

  try {
    setActiveStep('login_google');
    setUiProgress(0, 'Verificando conexão com a internet…');
    await connectivityMonitor.refresh();
    const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!browserOnline || !connectivityMonitor.canSync()) {
      throw new Error('offline');
    }

    setUiProgress(0, 'Verificando sessão Google…');

    if (!syncAuthAvailable || !getFirebaseAuth()?.currentUser) {
      throw new Error(SYNC_AUTH_REQUIRED);
    }

    const authResult = await ensureAuth();
    if (!authResult.ok) {
      throw new Error(authResult.error ?? SYNC_AUTH_REQUIRED);
    }

    const loginUid = getCachedLoginUid();
    if (!loginUid) {
      throw new Error(SYNC_AUTH_REQUIRED);
    }

    completeStep('login_google');
    setUiProgress(0, 'Sessão Google confirmada ✓');
    setActiveStep('validate_permissions');
    setUiProgress(0, 'Confirmando sessão Google…');
    const authUser = getFirebaseAuth()?.currentUser;
    if (!authUser) {
      throw new Error(SYNC_AUTH_REQUIRED);
    }

    await systemState.setOnlineMode();

    setUiProgress(0, 'Validando permissões…');
    currentStep = 'validate_permissions';
    const session = await prepareSyncSession(loginUid, authUser.email);
    ownerUid = session.dataOwnerUid;
    syncEngine.bindOwner(ownerUid);
    await syncEngine.init(ownerUid, { preserveOnlineMode: true });

    const firestoreProbe = await probeFirestoreConnectivityDetailed(ownerUid);
    if (!firestoreProbe.ok) {
      throw new Error(firestoreProbe.reason ?? 'Não foi possível conectar ao Firebase. Tente novamente.');
    }
    completeStep('validate_permissions');

    setActiveStep('local_backup');
    currentStep = 'local_backup';
    setUiProgress(0, 'Criando backup local…');
    backupIdBeforeSync = await createLocalBackup(ownerUid);

    setUiProgress(0, 'Verificando horário do sistema…');
    clockDriftResult = await detectClockDrift();
    completeStep('local_backup');

    mode = 'ONLINE_SYNCING';
    uiPhase = 'syncing';
    setActiveStep('comparing');
    currentStep = 'comparing';
    recordSyncStartedAt = Date.now();

    let lastProgressPhase: string | undefined;

    const result = await syncEngine.runLastWriteWinsSync({
      backupId: backupIdBeforeSync,
      clockDrift: clockDriftResult ?? undefined,
      userEmail: authUser.email ?? null,
      onProgress: ({ processed, total, message, stepId, pendingUploads, pendingDownloads, phase }) => {
        if (stepId) {
          currentStep = stepId;
          setActiveStep(stepId);
        }
        if (pendingUploads != null || pendingDownloads != null) {
          counters = {
            ...counters,
            pendingUploads: pendingUploads ?? counters.pendingUploads,
            pendingDownloads: pendingDownloads ?? counters.pendingDownloads,
          };
        }
        if (phase && phase !== lastProgressPhase) {
          if (phase === 'compare') completeStep('comparing');
          if (phase === 'download') completeStep('downloading');
          if (phase === 'upload') completeStep('uploading');
          if (phase === 'finalize') completeStep('finalizing');
          lastProgressPhase = phase;
        }
        const pct = total > 0 ? (processed / total) * 100 : 100;
        if (phase === 'download') {
          setDirectionProgress('download', pct, message, processed, total);
        } else if (phase === 'upload') {
          setDirectionProgress('upload', pct, message, processed, total);
        } else if (phase === 'compare') {
          setUiProgress(0, message, processed, total, undefined, 'preparing');
        } else {
          setUiProgress(pct, message, processed, total, undefined, 'finalize');
        }
      },
    });

    lastAudit = result.audit;

    await refreshPendingSummary();
    if (pendingSummary.total > 0) {
      setActiveStep('uploading');
      currentStep = 'uploading';
      setUiProgress(0, `Enviando ${pendingSummary.total} pendência(s)…`, 0, pendingSummary.total);
      const uploadResult = await syncEngine.uploadPendingOnly();
      if (!uploadResult.success) {
        throw new Error(uploadResult.error ?? 'upload_failed');
      }
      await refreshPendingSummary();
    }

    if (pendingSummary.total > 0) {
      throw new Error(`pending_remain:${pendingSummary.total}`);
    }

    if (!result.success) {
      if (backupIdBeforeSync != null) {
        setActiveStep('finalizing');
        setUiProgress(syncProgress.percent, 'Restaurando backup local…');
        await restoreLocalBackup(backupIdBeforeSync);
      }
      throw new Error(result.stats.errors[0] ?? 'upload_failed');
    }

    lastSyncAt = result.audit.finishedAt;
    await loadLastSyncFromAudit();

    completeStep('finalizing');
    await applyCountersAfterSuccessfulSync();
    notifyDataChanged();

    const durationMs = Date.now() - startedAt;
    const totalRecords = result.stats.uploads + result.stats.downloads;
    const avgRecordsPerSecond = totalRecords > 0 ? totalRecords / (durationMs / 1000) : 0;

    lastSyncResult = {
      uploads: result.stats.uploads,
      downloads: result.stats.downloads,
      ignored: result.stats.ignored,
      durationMs,
      finishedAt: Date.now(),
      avgRecordsPerSecond,
      alreadyUpToDate: result.alreadyUpToDate,
    };

    if (result.alreadyUpToDate && pendingSummary.total === 0) {
      uiPhase = 'already_up_to_date';
      syncMessage = 'Seu banco de dados já está atualizado.';
      setUiProgress(100, syncMessage, 0, 0);
      syncSteps = markStepsDoneThrough(syncSteps, 'finalizing');
      await applyCountersAfterSuccessfulSync();
      await syncLogger.info('sync-manager', 'Sync: banco já atualizado');
      scheduleReturnToOffline(ALREADY_UP_TO_DATE_MS);
      return { ok: true };
    }

    uiPhase = 'success';
    setUiProgress(100, 'Sincronização concluída', totalRecords, totalRecords);

    await syncLogger.info(
      'sync-manager',
      `Sync concluída em ${durationMs}ms: ↑${result.stats.uploads} ↓${result.stats.downloads} ⊘${result.stats.ignored}`,
    );

    scheduleReturnToOffline(SUCCESS_DISPLAY_MS);
    return { ok: true };
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);
    uploadError = formatSyncUploadError(rawError);
    uiPhase = 'error';
    errorStepId = currentStep;
    syncSteps = markStepError(syncSteps, currentStep);
    syncMessage = uploadError;
    mode = 'OFFLINE';
    await syncLogger.error('sync-manager', rawError);
    await systemState.setOfflineMode();
    syncEngine.deactivateOnlineMode();
    await syncEngine.shutdownSession();
    stopEtaTimer();
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

  setAuthAvailable(authenticated: boolean): void {
    syncAuthAvailable = authenticated;
    if (authenticated) {
      scheduleCloudQueueEstimate();
      startCloudDiffWatch();
    } else {
      stopCloudDiffWatch();
      counters = { ...counters, pendingDownloads: null };
    }
    notifyListeners();
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
    await syncEngine.preparePendingOwner(dataOwnerUid);
    await loadLastSyncFromAudit();
    await refreshPendingSummary();
    scheduleCloudQueueEstimate();
    if (syncAuthAvailable) {
      startCloudDiffWatch();
    }
    notifyListeners();
  },

  async evaluateOnSessionStart(): Promise<void> {
    ownerUid = getCachedDataOwnerUid();
    if (!ownerUid) return;
    await this.bindSession(ownerUid);
  },

  async evaluateOnReconnect(): Promise<void> {
    await refreshPendingSummary();
    await refreshCloudQueueEstimate(true);
    notifyListeners();
  },

  /** Revalida diferenças locais × nuvem (ex.: PWA voltou ao foco). */
  async refreshCloudDiff(): Promise<void> {
    if (!syncAuthAvailable || syncInFlight) {
      await refreshPendingSummary();
      notifyListeners();
      return;
    }
    await refreshPendingSummary();
    await refreshCloudQueueEstimate(true);
    notifyListeners();
  },

  onDisconnect(): void {
    if (mode === 'OFFLINE' && uiPhase === 'offline') return;
    if (syncInFlight) return;
    void returnToOfflineMode();
  },

  async startSyncFromToggle(ensureAuth?: EnsureAuthenticatedFn): Promise<{ ok: boolean; error?: string }> {
    if (!syncAuthAvailable || !getFirebaseAuth()?.currentUser) {
      return { ok: false, error: SYNC_AUTH_REQUIRED_MESSAGE };
    }
    const authFn = ensureAuth ?? storedEnsureAuth;
    if (!authFn) {
      return { ok: false, error: SYNC_AUTH_REQUIRED_MESSAGE };
    }
    return runSyncPipeline(authFn);
  },

  async retrySync(ensureAuth?: EnsureAuthenticatedFn): Promise<{ ok: boolean; error?: string }> {
    uploadError = null;
    errorStepId = null;
    uiPhase = 'offline';
    syncSteps = createInitialSyncSteps();
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
    errorStepId = null;
    if (uiPhase === 'error') uiPhase = 'offline';
    notifyListeners();
  },

  openSyncModal(): void {},

  scheduleOnlineWriteFlush(): void {},

  async refreshPending(): Promise<PendingSyncSummary> {
    const summary = await refreshPendingSummary();
    scheduleCloudQueueEstimate();
    notifyListeners();
    return summary;
  },

  async shutdown(): Promise<void> {
    stopCloudDiffWatch();
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
