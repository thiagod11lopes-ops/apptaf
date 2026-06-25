type CloudActivityListener = (state: CloudActivityState) => void;

export type CloudActivityState = {
  /** Operações de escrita na nuvem em andamento. */
  uploading: boolean;
  /** Sincronização completa (pull/merge) em andamento. */
  syncing: boolean;
  /** Uploads individuais ativos (contador). */
  activeUploads: number;
};

let activeUploads = 0;
let syncing = false;
const listeners = new Set<CloudActivityListener>();

function snapshot(): CloudActivityState {
  return {
    uploading: activeUploads > 0,
    syncing,
    activeUploads,
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
  notify();
}

export function endCloudSync(): void {
  syncing = false;
  notify();
}

export async function withCloudSync<T>(fn: () => Promise<T>): Promise<T> {
  beginCloudSync();
  try {
    return await fn();
  } finally {
    endCloudSync();
  }
}
