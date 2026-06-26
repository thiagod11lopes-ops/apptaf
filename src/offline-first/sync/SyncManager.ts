import { getCachedDataOwnerUid, getCachedLoginUid } from '../../services/firebase/authUid';
import { connectivityMonitor } from './ConnectivityMonitor';
import { getPendingSyncItems, type PendingSyncSummary } from './pendingSyncItems';
import { syncEngine } from './SyncEngine';
import { systemState } from './SystemState';
import { beginAwaitingCloudConfirmation, confirmCloudDisplayReady } from './cloudDisplayGate';
import { syncLogger } from './SyncLogger';

/** CLOUD_ACTIVE = lê só dados synced da nuvem; LOCAL_ONLY = lê todo o IndexedDB. */
export type SyncManagerMode = 'CLOUD_ACTIVE' | 'LOCAL_ONLY';

export type SyncManagerState = {
  mode: SyncManagerMode;
  pendingSummary: PendingSyncSummary;
  uploading: boolean;
  /** Modal de envio de alterações offline — exibido ao reconectar com pendências. */
  syncModalVisible: boolean;
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
let uploading = false;
let syncModalRequired = false;
let sessionEvalInFlight = false;
let uploadInFlight = false;
const listeners = new Set<Listener>();

function snapshot(): SyncManagerState {
  return {
    mode,
    pendingSummary,
    uploading,
    syncModalVisible: syncModalRequired && pendingSummary.total > 0,
  };
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn(snapshot()));
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
  await syncEngine.preparePendingOwner(ownerUid);
  pendingSummary = await getPendingSyncItems(ownerUid);
  if (pendingSummary.total === 0) {
    syncModalRequired = false;
  }
  return pendingSummary;
}

/** Online + modo nuvem = exibir apenas registros synced (cópia da nuvem no IndexedDB). */
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
  syncModalRequired = false;
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

async function uploadPendingAndEnterCloud(): Promise<void> {
  if (!ownerUid || uploadInFlight) return;

  uploadInFlight = true;
  uploading = true;
  syncModalRequired = false;
  notifyListeners();

  try {
    await systemState.setOnlineActive();
    syncEngine.bindOwner(ownerUid);

    const result = await syncEngine.uploadPendingOnly();
    await refreshPendingSummary();

    if (!result.success || pendingSummary.total > 0) {
      await syncLogger.warn('sync-manager', result.error ?? 'upload_incomplete');
      mode = 'LOCAL_ONLY';
      syncEngine.deactivateOnlineMode();
      syncModalRequired = pendingSummary.total > 0;
      notifyListeners();
      return;
    }

    await enterCloudActive();
  } catch (error) {
    await syncLogger.error(
      'sync-manager',
      error instanceof Error ? error.message : String(error),
    );
    mode = 'LOCAL_ONLY';
    syncEngine.deactivateOnlineMode();
    syncModalRequired = pendingSummary.total > 0;
    notifyListeners();
  } finally {
    uploading = false;
    uploadInFlight = false;
    notifyListeners();
  }
}

async function evaluateSession(trigger: string): Promise<void> {
  if (!ownerUid || !isLoggedIn()) {
    mode = 'LOCAL_ONLY';
    pendingSummary = EMPTY_SUMMARY;
    syncModalRequired = false;
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

    if (!online) {
      mode = 'LOCAL_ONLY';
      syncEngine.deactivateOnlineMode();
      notifyListeners();
      return;
    }

    if (hasPending) {
      mode = 'LOCAL_ONLY';
      syncEngine.deactivateOnlineMode();
      syncModalRequired = true;
      notifyListeners();
      return;
    }

    await enterCloudActive();
  } finally {
    sessionEvalInFlight = false;
  }
}

export const syncManager = {
  async bindSession(dataOwnerUid: string): Promise<void> {
    ownerUid = dataOwnerUid;
    syncEngine.bindOwner(dataOwnerUid);
    await systemState.hydrate();
    await systemState.setOnlineActive();
    connectivityMonitor.start();
    syncEngine.deactivateOnlineMode();
    mode = 'LOCAL_ONLY';
  },

  async evaluateOnSessionStart(): Promise<void> {
    ownerUid = getCachedDataOwnerUid();
    if (!ownerUid) return;
    await this.bindSession(ownerUid);
    await evaluateSession('session-start');
  },

  async evaluateOnReconnect(): Promise<void> {
    await refreshPendingSummary();
    await evaluateSession('reconnect');
  },

  onDisconnect(): void {
    syncEngine.deactivateOnlineMode();
    mode = 'LOCAL_ONLY';
    notifyListeners();
  },

  /** Usuário confirmou envio das alterações offline para a nuvem. */
  async confirmUploadToCloud(): Promise<void> {
    await uploadPendingAndEnterCloud();
  },

  /** Usuário adiou o envio — continua exibindo dados locais. */
  dismissSyncModal(): void {
    syncModalRequired = false;
    mode = 'LOCAL_ONLY';
    syncEngine.deactivateOnlineMode();
    notifyListeners();
  },

  /** Reabre o modal quando há pendências e ainda não está em modo nuvem. */
  openSyncModal(): void {
    if (pendingSummary.total > 0 && canReachFirebase()) {
      syncModalRequired = true;
      notifyListeners();
    }
  },

  scheduleOnlineWriteFlush(): void {
    if (mode !== 'CLOUD_ACTIVE' || !canReachFirebase() || !ownerUid) return;
    syncEngine.scheduleRealtimeFlush();
  },

  async refreshPending(): Promise<PendingSyncSummary> {
    const summary = await refreshPendingSummary();
    notifyListeners();
    return summary;
  },

  shutdown(): void {
    syncEngine.shutdown();
    ownerUid = null;
    mode = 'LOCAL_ONLY';
    pendingSummary = EMPTY_SUMMARY;
    uploading = false;
    syncModalRequired = false;
    notifyListeners();
  },

  isCloudReadActive,
  getMode(): SyncManagerMode {
    return mode;
  },
};
