import { signOutFirebase } from '../../services/firebase/googleAuth';
import { getCachedDataOwnerUid, getCachedLoginUid } from '../../services/firebase/authUid';
import { getFirebaseAuth } from '../../config/firebase';
import { connectivityMonitor } from './ConnectivityMonitor';
import { getPendingSyncItems, type PendingSyncSummary } from './pendingSyncItems';
import { syncEngine } from './SyncEngine';
import { systemState } from './SystemState';
import { syncLogger } from './SyncLogger';
import { buildSyncReport, type SyncReport } from './syncReport';
import { createLocalBackup, restoreLocalBackup } from './localBackup';
import { detectClockDrift, type ClockDriftResult } from './clockDrift';
import { prepareSyncSession } from './syncSessionPrepare';
import { probeFirestoreConnectivity } from './firebase/FirebaseGateway';
import {
  progressForStep,
  type SyncAssistantProgress,
  type SyncAssistantStep,
} from './syncAssistantSteps';
import type { SyncAuditEntry } from './syncAudit';

/** App opera offline por padrão; online apenas durante sync manual. */
export type SyncManagerMode = 'OFFLINE' | 'ONLINE_PREPARING' | 'ONLINE_SYNCING';

export type SyncManagerState = {
  mode: SyncManagerMode;
  pendingSummary: PendingSyncSummary;
  syncReport: SyncReport | null;
  uploading: boolean;
  syncModalVisible: boolean;
  uploadError: string | null;
  assistantProgress: SyncAssistantProgress | null;
  clockDriftWarning: string | null;
  lastAudit: SyncAuditEntry | null;
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
let assistantProgress: SyncAssistantProgress | null = null;
let clockDriftWarning: string | null = null;
let lastAudit: SyncAuditEntry | null = null;
let backupIdBeforeSync: number | null = null;
let clockDriftResult: ClockDriftResult | null = null;
const listeners = new Set<Listener>();

function snapshot(): SyncManagerState {
  return {
    mode,
    pendingSummary,
    syncReport,
    uploading,
    syncModalVisible,
    uploadError,
    assistantProgress,
    clockDriftWarning,
    lastAudit,
  };
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn(snapshot()));
}

function setProgress(step: SyncAssistantStep, message: string): void {
  assistantProgress = progressForStep(step, message);
  notifyListeners();
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

async function returnToOfflineMode(): Promise<void> {
  syncEngine.deactivateOnlineMode();
  await syncEngine.shutdownSession();
  await systemState.setOfflineMode();
  mode = 'OFFLINE';
  syncReport = null;
  syncModalVisible = false;
  uploading = false;
  uploadError = null;
  assistantProgress = null;
  clockDriftWarning = null;
  backupIdBeforeSync = null;
  clockDriftResult = null;
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

  async evaluateOnReconnect(): Promise<void> {
    await refreshPendingSummary();
    notifyListeners();
  },

  onDisconnect(): void {
    if (mode === 'OFFLINE') return;
    void returnToOfflineMode();
  },

  /**
   * Assistente de sincronização: conecta, valida, compara e exibe relatório.
   * Requer usuário autenticado (login Google feito antes).
   */
  async enterOnlineMode(): Promise<{ ok: boolean; error?: string }> {
    if (syncInFlight) return { ok: false, error: 'sync_in_progress' };

    const loginUid = getCachedLoginUid();
    if (!loginUid) {
      return { ok: false, error: 'Faça login com Google antes de sincronizar.' };
    }

    syncInFlight = true;
    uploading = true;
    uploadError = null;
    mode = 'ONLINE_PREPARING';
    assistantProgress = progressForStep('CONNECTING', 'Verificando conexão…');
    notifyListeners();

    try {
      setProgress('CONNECTING', 'Verificando conexão com a internet…');
      await connectivityMonitor.refresh();
      const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (!browserOnline || !connectivityMonitor.canSync()) {
        return { ok: false, error: 'offline' };
      }

      setProgress('LOGIN', 'Confirmando sessão Google…');
      const authUser = getFirebaseAuth()?.currentUser;
      if (!authUser) {
        return { ok: false, error: 'Faça login com Google antes de sincronizar.' };
      }

      await systemState.setOnlineMode();

      setProgress('VALIDATING', 'Validando permissões e preparando dados locais…');
      const session = await prepareSyncSession(loginUid, authUser.email);
      ownerUid = session.dataOwnerUid;
      syncEngine.bindOwner(ownerUid);
      await syncEngine.init(ownerUid);

      const firestoreOk = await probeFirestoreConnectivity();
      if (!firestoreOk) {
        return { ok: false, error: 'Não foi possível conectar ao Firebase. Tente novamente.' };
      }

      setProgress('BACKUP', 'Criando backup local automático…');
      backupIdBeforeSync = await createLocalBackup(ownerUid);

      setProgress('CLOCK_CHECK', 'Verificando horário do sistema…');
      clockDriftResult = await detectClockDrift();
      clockDriftWarning = clockDriftResult.warningMessage;
      if (clockDriftResult.warning) {
        await syncLogger.info('sync-manager', `Clock drift: ${clockDriftResult.driftMs}ms`);
      }

      setProgress('COMPARING', 'Comparando banco local com a nuvem…');
      syncReport = await buildSyncReport(ownerUid, clockDriftWarning);
      await refreshPendingSummary();

      setProgress('REPORT', 'Revise o relatório e confirme a sincronização.');
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

  async confirmManualSync(): Promise<void> {
    if (!ownerUid || syncInFlight) return;

    syncInFlight = true;
    uploading = true;
    uploadError = null;
    mode = 'ONLINE_SYNCING';
    syncModalVisible = false;
    setProgress('SYNCING', 'Executando sincronização (Last Write Wins)…');
    notifyListeners();

    const authUser = getFirebaseAuth()?.currentUser;
    const startedAt = Date.now();

    try {
      const result = await syncEngine.runLastWriteWinsSync({
        backupId: backupIdBeforeSync,
        clockDrift: clockDriftResult ?? undefined,
        userEmail: authUser?.email ?? null,
      });

      lastAudit = result.audit;

      if (!result.success) {
        if (backupIdBeforeSync != null) {
          setProgress('SYNCING', 'Restaurando backup local após falha…');
          await restoreLocalBackup(backupIdBeforeSync);
        }
        uploadError = formatSyncUploadError(result.stats.errors[0] ?? 'upload_failed');
        syncModalVisible = true;
        mode = 'ONLINE_PREPARING';
        setProgress('REPORT', 'Sincronização falhou. Revise e tente novamente.');
        notifyListeners();
        return;
      }

      setProgress('AUDIT', 'Registrando auditoria…');
      await refreshPendingSummary();
      await syncLogger.info(
        'sync-manager',
        `LWW concluída em ${Date.now() - startedAt}ms: ↑${result.stats.uploads} ↓${result.stats.downloads} ⊘${result.stats.ignored}`,
      );
    } catch (error) {
      if (backupIdBeforeSync != null) {
        try {
          await restoreLocalBackup(backupIdBeforeSync);
        } catch {
          // backup restore failed — logged below
        }
      }
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

    setProgress('DONE', 'Sincronização concluída. Retornando ao modo offline…');
    notifyListeners();

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
