type CloudActivityListener = (state: CloudActivityState) => void;

export type CloudActivityState = {
  /** Operações de escrita na nuvem em andamento. */
  uploading: boolean;
  /** Sincronização completa (pull/merge) em andamento. */
  syncing: boolean;
  /** Progresso estimado da sincronização (0–100). */
  syncProgress: number;
  /** Uploads individuais ativos (contador). */
  activeUploads: number;
  /** Última sincronização bem-sucedida com Firebase (ms). */
  lastSyncedAt: number | null;
  /** Dados reconciliados com a nuvem (não só cache local). */
  cloudReady: boolean;
  /** Escuta ativa do Firestore (tempo real). */
  realtimeListening: boolean;
  /** Aplicando atualização remota recebida em tempo real. */
  realtimeApplying: boolean;
};

let activeUploads = 0;
let syncing = false;
let syncProgress = 0;
let realtimeListening = false;
let realtimeApplying = false;
let lastSyncedAt: number | null = null;
let cloudReady = false;
const listeners = new Set<CloudActivityListener>();

function snapshot(): CloudActivityState {
  return {
    uploading: activeUploads > 0,
    syncing,
    syncProgress,
    activeUploads,
    lastSyncedAt,
    cloudReady,
    realtimeListening,
    realtimeApplying,
  };
}

function notify(): void {
  const state = snapshot();
  listeners.forEach((fn) => fn(state));
}

export function getCloudActivityState(): CloudActivityState {
  return snapshot();
}

export function subscribeCloudActivity(listener: CloudActivityListener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function beginCloudUpload(): void {
  activeUploads += 1;
  notify();
}

export function endCloudUpload(): void {
  activeUploads = Math.max(0, activeUploads - 1);
  notify();
}

export async function withCloudUpload<T>(fn: () => Promise<T>): Promise<T> {
  beginCloudUpload();
  try {
    return await fn();
  } finally {
    endCloudUpload();
  }
}

export function beginCloudSync(): void {
  syncing = true;
  syncProgress = 8;
  notify();
}

export function endCloudSync(): void {
  syncing = false;
  syncProgress = 0;
  notify();
}

export function setSyncProgress(percent: number): void {
  syncProgress = Math.max(0, Math.min(100, Math.round(percent)));
  notify();
}

export async function withCloudSync<T>(fn: () => Promise<T>): Promise<T> {
  beginCloudSync();
  try {
    const result = await fn();
    setCloudSyncResult(true);
    return result;
  } catch (error) {
    setCloudSyncResult(false);
    throw error;
  } finally {
    endCloudSync();
  }
}

export function setCloudSyncResult(ok: boolean): void {
  if (ok) {
    lastSyncedAt = Date.now();
    cloudReady = true;
  } else {
    cloudReady = false;
  }
  notify();
}

export function resetCloudSyncStatus(): void {
  lastSyncedAt = null;
  cloudReady = false;
  syncProgress = 0;
  realtimeListening = false;
  realtimeApplying = false;
  notify();
}

export function setRealtimeListening(active: boolean): void {
  realtimeListening = active;
  notify();
}

export function beginRealtimeApply(): void {
  realtimeApplying = true;
  notify();
}

export function endRealtimeApply(): void {
  realtimeApplying = false;
  notify();
}
