import { signOutFirebase } from '../../services/firebase/googleAuth';
import { getCachedDataOwnerUid, getCachedLoginUid } from '../../services/firebase/authUid';
import { connectivityMonitor } from './ConnectivityMonitor';
import { getPendingSyncItems, type PendingSyncSummary } from './pendingSyncItems';
import { syncEngine } from './SyncEngine';
import { systemState } from './SystemState';
import { syncLogger } from './SyncLogger';
import { buildSyncReport, type SyncReport } from './syncReport';

/** App opera offline por padrão; online apenas durante sync manual. */
export type SyncManagerMode = 'OFFLINE' | 'ONLINE_PREPARING' | 'ONLINE_SYNCING';

export type SyncManagerState = {
  mode: SyncManagerMode;
  pendingSummary: PendingSyncSummary;
  syncReport: SyncReport | null;
  uploading: boolean;
  /** Tela de confirmação antes de sincronizar. */
  syncModalVisible: boolean;
  uploadError: string | null;
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

type Listener = (state: SyncManagerState) => void;

let ownerUid: string | null = null;
let mode: SyncManagerMode = 'OFFLINE';
let pendingSummary: PendingSyncSummary = EMPTY_SUMMARY;
let syncReport: SyncReport | null = null;
let uploading = false;
let syncModalVisible = false;
let uploadError: string | null = null;
let syncInFlight = false;
const listeners = new Set<Listener>();

function snapshot(): SyncManagerState {
  return {
    mode,
    pendingSummary,
    syncReport,
    uploading,
    syncModalVisible,
    uploadError,
  };
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn(snapshot()));
}

function isLoggedIn(): boolean {
  return getCachedLoginUid() != null && ownerUid != null;
}

async function refreshPendingSummary(): Promise<PendingSyncSummary> {
  const uid = ownerUid ?? getCachedDataOwnerUid();
  if (!uid) {
    pendingSummary = EMPTY_SUMMARY;
    return EMPTY_SUMMARY;
  }
  ownerUid = uid;
  await syncEngine.preparePendingOwner(uid);
  pendingSummary = await getPendingSyncItems(uid);
  return pendingSummary;
}

/** UI lê sempre do IndexedDB — não há gate de snapshot synced. */
export function isCloudReadActive(): boolean {
  return false;
}

/** @deprecated UI usa somente dados locais. */
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

async function returnToOfflineMode(): Promise<void> {
  syncEngine.deactivateOnlineMode();
  await syncEngine.shutdownSession();
  await systemState.setOfflineMode();
  mode = 'OFFLINE';
  syncReport = null;
  syncModalVisible = false;
  uploading = false;
  uploadError = null;
  notifyListeners();
}

export const syncManager = {
  async bindSession(dataOwnerUid: string): Promise<void> {
    ownerUid = dataOwnerUid;
    syncEngine.bindOwner(dataOwnerUid);
    await systemState.hydrate();
    await systemState.setOfflineMode();
    connectivityMonitor.start();
    syncEngine.deactivateOnlineMode();
    mode = 'OFFLINE';
    await refreshPendingSummary();
    notifyListeners();
  },

  async evaluateOnSessionStart(): Promise<void> {
    ownerUid = getCachedDataOwnerUid();
    if (!ownerUid) return;
    await this.bindSession(ownerUid);
  },

  /** @deprecated reconexão não dispara sync automático */
  async evaluateOnReconnect(): Promise<void> {
    await refreshPendingSummary();
    notifyListeners();
  },

  onDisconnect(): void {
    if (mode === 'OFFLINE') return;
    void returnToOfflineMode();
  },

  /**
   * Entrar em modo online: conecta Firebase, compara dados e exibe relatório.
   * Requer usuário autenticado (login Google feito antes).
   */
  async enterOnlineMode(): Promise<{ ok: boolean; error?: string }> {
    if (syncInFlight) return { ok: false, error: 'sync_in_progress' };
    ownerUid = getCachedDataOwnerUid();
    if (!ownerUid || !isLoggedIn()) {
      return { ok: false, error: 'Faça login com Google antes de sincronizar.' };
    }

    syncInFlight = true;
    uploading = true;
    uploadError = null;
    mode = 'ONLINE_PREPARING';
    notifyListeners();

    try {
      await connectivityMonitor.refresh();
      if (!connectivityMonitor.canSync()) {
        const browserOnline =
          typeof navigator === 'undefined' || navigator.onLine !== false;
        if (!browserOnline) {
          return { ok: false, error: 'offline' };
        }
      }

      await systemState.setOnlineMode();
      syncEngine.bindOwner(ownerUid);
      await syncEngine.init(ownerUid);

      syncReport = await buildSyncReport(ownerUid);
      await refreshPendingSummary();
      syncModalVisible = true;
      mode = 'ONLINE_PREPARING';
      notifyListeners();
      return { ok: true };
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error);
      uploadError = formatSyncUploadError(rawError);
      await syncLogger.error('sync-manager', rawError);
      await returnToOfflineMode();
      return { ok: false, error: uploadError };
    } finally {
      uploading = false;
      syncInFlight = false;
      notifyListeners();
    }
  },

  /** Usuário confirmou sincronização após revisar o relatório. */
  async confirmManualSync(): Promise<void> {
    if (!ownerUid || syncInFlight) return;

    syncInFlight = true;
    uploading = true;
    uploadError = null;
    mode = 'ONLINE_SYNCING';
    syncModalVisible = false;
    notifyListeners();

    try {
      const result = await syncEngine.runLastWriteWinsSync();
      if (!result.success) {
        uploadError = formatSyncUploadError(result.stats.errors[0] ?? 'upload_failed');
        syncModalVisible = true;
        mode = 'ONLINE_PREPARING';
        notifyListeners();
        return;
      }

      await refreshPendingSummary();
      await syncLogger.info(
        'sync-manager',
        `LWW concluída: ↑${result.stats.uploads} ↓${result.stats.downloads} ⊘${result.stats.ignored}`,
      );
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error);
      uploadError = formatSyncUploadError(rawError);
      syncModalVisible = true;
      mode = 'ONLINE_PREPARING';
      await syncLogger.error('sync-manager', rawError);
      notifyListeners();
      return;
    } finally {
      uploading = false;
      syncInFlight = false;
    }

    try {
      await signOutFirebase();
    } catch {
      // mantém sessão local se sign-out falhar
    }
    await returnToOfflineMode();
  },

  cancelOnlineMode(): void {
    void returnToOfflineMode();
  },

  dismissSyncModal(): void {
    syncModalVisible = false;
    void returnToOfflineMode();
  },

  clearUploadError(): void {
    uploadError = null;
    notifyListeners();
  },

  openSyncModal(): void {
    if (pendingSummary.total > 0) {
      syncModalVisible = true;
      notifyListeners();
    }
  },

  /** @deprecated sync é manual — mutações locais não disparam upload */
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
};
