import { getCachedDataOwnerUid, getCachedLoginUid } from '../../services/firebase/authUid';
import { connectivityMonitor } from './ConnectivityMonitor';
import { getPendingSyncItems, type PendingSyncSummary } from './pendingSyncItems';
import { syncEngine } from './SyncEngine';
import { systemState } from './SystemState';
import { beginAwaitingCloudConfirmation, confirmCloudDisplayReady } from './cloudDisplayGate';
import { syncLogger } from './SyncLogger';

/** CLOUD_ACTIVE = online, lê snapshot synced da nuvem; OFFLINE_SNAPSHOT = offline, último snapshot synced. */
export type SyncManagerMode = 'CLOUD_ACTIVE' | 'OFFLINE_SNAPSHOT';

export type SyncManagerState = {
  mode: SyncManagerMode;
  pendingSummary: PendingSyncSummary;
  uploading: boolean;
  /** Modal de envio de alterações offline — exibido ao reconectar com pendências. */
  syncModalVisible: boolean;
  /** Mensagem amigável quando o envio para a nuvem falha. */
  uploadError: string | null;
};

export function formatSyncUploadError(raw?: string | null): string {
  if (!raw?.trim()) {
    return 'Falha ao enviar alterações para a nuvem. Tente novamente.';
  }
  const msg = raw.trim();
  if (msg === 'offline') {
    return 'Sem conexão com a internet. Verifique a rede e tente novamente.';
  }
  if (msg === 'upload_failed' || msg === 'upload_incomplete' || msg === 'pending_remain') {
    return 'Não foi possível enviar as alterações para a nuvem. Tente novamente.';
  }
  if (msg === 'no_owner') {
    return 'Sessão inválida. Saia e entre novamente com Google.';
  }
  if (/permission|permiss[aã]o|denied|insufficient/i.test(msg)) {
    return 'Permissão negada ao enviar para a nuvem. Verifique sua conta.';
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

type Listener = (state: SyncManagerState) => void;

let ownerUid: string | null = null;
let mode: SyncManagerMode = 'OFFLINE_SNAPSHOT';
let pendingSummary: PendingSyncSummary = EMPTY_SUMMARY;
let uploading = false;
let syncModalRequired = false;
let uploadError: string | null = null;
let sessionEvalInFlight = false;
let uploadInFlight = false;
const listeners = new Set<Listener>();

function snapshot(): SyncManagerState {
  return {
    mode,
    pendingSummary,
    uploading,
    syncModalVisible: syncModalRequired && pendingSummary.total > 0,
    uploadError,
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
    uploadError = null;
  }
  return pendingSummary;
}

/** Online + logado = exibir snapshot synced baixado da nuvem. */
export function isCloudReadActive(): boolean {
  return mode === 'CLOUD_ACTIVE' && canReachFirebase() && isLoggedIn();
}

/** Logado: exibe só registros synced (nuvem online ou último snapshot offline). */
export function isSyncedDisplayActive(): boolean {
  if (!isLoggedIn()) return false;
  return mode === 'CLOUD_ACTIVE' || mode === 'OFFLINE_SNAPSHOT';
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
  uploadError = null;
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
  uploadError = null;
  syncModalRequired = false;
  notifyListeners();

  try {
    await systemState.setOnlineActive();
    syncEngine.bindOwner(ownerUid);

    const result = await syncEngine.uploadPendingOnly();
    await refreshPendingSummary();

    if (!result.success || pendingSummary.total > 0) {
      const rawError = result.error ?? (pendingSummary.total > 0 ? 'pending_remain' : 'upload_failed');
      uploadError = formatSyncUploadError(rawError);
      await syncLogger.warn('sync-manager', rawError);
      syncModalRequired = pendingSummary.total > 0;
      if (canReachFirebase()) {
        await enterCloudActive();
      } else {
        mode = 'OFFLINE_SNAPSHOT';
        syncEngine.deactivateOnlineMode();
      }
      notifyListeners();
      return;
    }

    await enterCloudActive();
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);
    uploadError = formatSyncUploadError(rawError);
    await syncLogger.error('sync-manager', rawError);
    syncModalRequired = pendingSummary.total > 0;
    if (canReachFirebase()) {
      await enterCloudActive();
    } else {
      mode = 'OFFLINE_SNAPSHOT';
      syncEngine.deactivateOnlineMode();
    }
    notifyListeners();
  } finally {
    uploading = false;
    uploadInFlight = false;
    notifyListeners();
  }
}

async function evaluateSession(trigger: string): Promise<void> {
  if (!ownerUid || !isLoggedIn()) {
    mode = 'OFFLINE_SNAPSHOT';
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
      mode = 'OFFLINE_SNAPSHOT';
      syncEngine.deactivateOnlineMode();
      syncModalRequired = false;
      notifyListeners();
      return;
    }

    syncModalRequired = hasPending;
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
    mode = 'OFFLINE_SNAPSHOT';
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
    mode = 'OFFLINE_SNAPSHOT';
    notifyListeners();
  },

  /** Usuário confirmou envio das alterações offline para a nuvem. */
  async confirmUploadToCloud(): Promise<void> {
    await uploadPendingAndEnterCloud();
  },

  /** Usuário adiou o envio — continua exibindo dados da nuvem. */
  dismissSyncModal(): void {
    syncModalRequired = false;
    notifyListeners();
  },

  clearUploadError(): void {
    uploadError = null;
    notifyListeners();
  },

  /** Reabre o modal quando há pendências e ainda não enviou. */
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
    mode = 'OFFLINE_SNAPSHOT';
    pendingSummary = EMPTY_SUMMARY;
    uploading = false;
    syncModalRequired = false;
    uploadError = null;
    notifyListeners();
  },

  isCloudReadActive,
  isSyncedDisplayActive,
  getMode(): SyncManagerMode {
    return mode;
  },
};
