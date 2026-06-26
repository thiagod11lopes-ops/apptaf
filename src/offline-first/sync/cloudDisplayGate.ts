/** Logado: só exibir registros confirmados pela nuvem até upload + pull concluírem. */
let awaitingCloudConfirmation = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((fn) => fn());
}

export function beginAwaitingCloudConfirmation(): void {
  awaitingCloudConfirmation = true;
  notifyListeners();
}

export function confirmCloudDisplayReady(): void {
  if (!awaitingCloudConfirmation) return;
  awaitingCloudConfirmation = false;
  notifyListeners();
}

export function isAwaitingCloudConfirmation(): boolean {
  return awaitingCloudConfirmation;
}

export function subscribeCloudDisplayGate(listener: () => void): () => void {
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
}
