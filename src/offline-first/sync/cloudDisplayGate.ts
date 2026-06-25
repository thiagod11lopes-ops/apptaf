/** Logado: só exibir registros confirmados pela nuvem até upload + pull concluírem. */
let awaitingCloudConfirmation = false;

export function beginAwaitingCloudConfirmation(): void {
  awaitingCloudConfirmation = true;
}

export function confirmCloudDisplayReady(): void {
  awaitingCloudConfirmation = false;
}

export function isAwaitingCloudConfirmation(): boolean {
  return awaitingCloudConfirmation;
}
