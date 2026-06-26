import { getCachedDataOwnerUid, getCachedLoginUid } from '../../services/firebase/authUid';
import { connectivityMonitor } from './ConnectivityMonitor';
import { getPendingSyncItems, type PendingSyncSummary } from './pendingSyncItems';
import { syncEngine } from './SyncEngine';
import { systemState, SYSTEM_STATE } from './SystemState';
import { beginAwaitingCloudConfirmation, confirmCloudDisplayReady } from './cloudDisplayGate';
import { syncLogger } from './SyncLogger';

/** CLOUD_ACTIVE = Firebase é fonte de leitura; LOCAL_ONLY = só IndexedDB; GATED = pendências aguardando decisão. */
export type SyncManagerMode = 'CLOUD_ACTIVE' | 'LOCAL_ONLY' | 'GATED';

export type SyncManagerState = {
  mode: SyncManagerMode;
  pendingSummary: PendingSyncSummary;
  showPendingModal: boolean;
  uploading: boolean;
  lastError: string | null;
};

const EMPTY_SUMMARY: PendingSyncSummary = {
  items: [],
  total: 0,
  cadastros: 0,
  sessoes: 0,
  aplicadores: 0,
};

type Listener = (state: SyncManagerState) => void;

let ownerUid: string | null = null;
let mode: SyncManagerMode = 'LOCAL_ONLY';
let pendingSummary: PendingSyncSummary = EMPTY_SUMMARY;
let showPendingModal = false;
let uploading = false;
let lastError: string | null = null;
let sessionEvalInFlight = false;
let uploadInFlight = false;
const listeners = new Set<Listener>();

function snapshot(): SyncManagerState {
  return { mode, pendingSummary, showPendingModal, uploading, lastError };
}

function notifyListeners(): void {
  const s = snapshot();
  listeners.forEach((fn) => fn(s));
}

function canReachFirebase(): boolean {
  return connectivityMonitor.canSync() && systemState.canUseFirebase();
}

function isLoggedIn(): boolean {
  return getCachedLoginUid() != null && ownerUid != null;
}

async function refreshPendingSummary(): Promise<PendingSyncSummary> {
  if (!ownerUid || !isLoggedIn()) {
    pendingSummary = EMPTY_SUMMARY;
    return EMPTY_SUMMARY;
  }
  pendingSummary = await getPendingSyncItems(ownerUid);
  return pendingSummary;
}

/** Leitura exclusiva da nuvem (via cópia synced no IndexedDB). */
export function isCloudReadActive(): boolean {
  return mode === 'CLOUD_ACTIVE' && canReachFirebase() && isLoggedIn();
}

export function getSyncManagerState(): SyncManagerState {
  return snapshot();
}

export function subscribeSyncManager(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

async function enterCloudActive(): Promise<void> {
  if (!ownerUid) return;
  mode = 'CLOUD_ACTIVE';
  showPendingModal = false;
  lastError = null;
  notifyListeners();

  beginAwaitingCloudConfirmation();
  try {
    await systemState.setOnlineActive();
    await syncEngine.connectOnlineFromCloud();
  } finally {
    confirmCloudDisplayReady();
    notifyListeners();
  }
}

async function enterLocalOnly(forcedOffline: boolean): Promise<void> {
  mode = 'LOCAL_ONLY';
  showPendingModal = false;
  if (forcedOffline) {
    await systemState.setForcedOffline();
    syncEngine.deactivateOnlineMode();
  }
  notifyListeners();
}

async function evaluateSession(trigger: string): Promise<void> {
  if (!ownerUid || !isLoggedIn()) {
    mode = 'LOCAL_ONLY';
    showPendingModal = false;
    pendingSummary = EMPTY_SUMMARY;
    notifyListeners();
    return;
  }

  if (sessionEvalInFlight) return;
  sessionEvalInFlight = true;

  try {
    syncEngine.bindOwner(ownerUid);
    const summary = await refreshPendingSummary();
    const hasPending = summary.total > 0;
    const online = canReachFirebase();

    await syncLogger.info('sync-manager', `${trigger}: pending=${summary.total}, online=${online}, mode=${mode}`);

    if (systemState.isForcedOffline()) {
      mode = 'LOCAL_ONLY';
      showPendingModal = trigger !== 'session-start' && trigger !== 'reconnect' ? false : (hasPending && online);
      notifyListeners();
      return;
    }

    if (hasPending && online) {
      mode = 'GATED';
      showPendingModal = true;
      syncEngine.deactivateOnlineMode();
      notifyListeners();
      return;
    }

    if (hasPending && !online) {
      mode = 'LOCAL_ONLY';
      showPendingModal = false;
      notifyListeners();
      return;
    }

    if (!hasPending && online) {
      await enterCloudActive();
      return;
    }

    mode = 'LOCAL_ONLY';
    showPendingModal = false;
    notifyListeners();
  } finally {
    sessionEvalInFlight = false;
  }
}

export const syncManager = {
  /** Vincula owner e prepara motor (sem sync automático). */
  async bindSession(dataOwnerUid: string): Promise<void> {
    ownerUid = dataOwnerUid;
    syncEngine.bindOwner(dataOwnerUid);
    await systemState.hydrate();
    connectivityMonitor.start();
    syncEngine.deactivateOnlineMode();
  },

  /** Chamado após login, reload, reconexão ou F5. */
  async evaluateOnSessionStart(): Promise<void> {
    ownerUid = getCachedDataOwnerUid();
    if (!ownerUid) return;
    await this.bindSession(ownerUid);
    await evaluateSession('session-start');
  },

  /** Chamado quando a internet volta. */
  async evaluateOnReconnect(): Promise<void> {
    await refreshPendingSummary();
    await evaluateSession('reconnect');
  },

  /** Chamado quando conectividade cai. */
  onDisconnect(): void {
    syncEngine.deactivateOnlineMode();
    if (pendingSummary.total > 0) {
      mode = 'LOCAL_ONLY';
    } else if (mode === 'CLOUD_ACTIVE') {
      mode = 'LOCAL_ONLY';
    }
    showPendingModal = false;
    notifyListeners();
  },

  /** Usuário confirmou "Enviar para a nuvem". */
  async confirmUploadPending(): Promise<{ success: boolean; error?: string }> {
    if (!ownerUid || uploadInFlight) {
      return { success: false, error: 'busy' };
    }

    uploadInFlight = true;
    uploading = true;
    lastError = null;
    notifyListeners();

    try {
      await systemState.setOnlineActive();
      syncEngine.bindOwner(ownerUid);

      const result = await syncEngine.uploadPendingOnly();
      if (!result.success) {
        lastError = result.error ?? 'upload_failed';
        await refreshPendingSummary();
        showPendingModal = pendingSummary.total > 0;
        notifyListeners();
        return result;
      }

      await refreshPendingSummary();
      if (pendingSummary.total > 0) {
        lastError = 'pending_remain';
        showPendingModal = true;
        notifyListeners();
        return { success: false, error: 'pending_remain' };
      }

      await enterCloudActive();
      return { success: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await syncLogger.error('sync-manager', lastError);
      showPendingModal = true;
      notifyListeners();
      return { success: false, error: lastError };
    } finally {
      uploading = false;
      uploadInFlight = false;
      notifyListeners();
    }
  },

  /** Usuário escolheu "Continuar offline" — mantém pendências, não envia. */
  async chooseContinueOffline(): Promise<void> {
    await enterLocalOnly(true);
    await refreshPendingSummary();
    showPendingModal = false;
    notifyListeners();
  },

  /**
   * Após mutação local: envia imediatamente somente se já estiver em CLOUD_ACTIVE
   * (sem pendências bloqueando o gate).
   */
  scheduleOnlineWriteFlush(): void {
    if (mode !== 'CLOUD_ACTIVE' || !canReachFirebase() || !ownerUid) return;
    syncEngine.scheduleRealtimeFlush();
  },

  async refreshPending(): Promise<PendingSyncSummary> {
    const summary = await refreshPendingSummary();
    if (summary.total > 0 && canReachFirebase() && !systemState.isForcedOffline()) {
      mode = 'GATED';
      showPendingModal = true;
      syncEngine.deactivateOnlineMode();
    }
    notifyListeners();
    return summary;
  },

  shutdown(): void {
    syncEngine.shutdown();
    ownerUid = null;
    mode = 'LOCAL_ONLY';
    pendingSummary = EMPTY_SUMMARY;
    showPendingModal = false;
    uploading = false;
    lastError = null;
    notifyListeners();
  },

  isCloudReadActive,
  getMode(): SyncManagerMode {
    return mode;
  },
};
