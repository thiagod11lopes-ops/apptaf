/**
 * Chave de conexão com a nuvem (UI).
 * Sempre inicia desligada a cada abertura/atualização da página (estado em memória).
 * Não persiste o estado "ligado" — o usuário precisa religar após F5.
 */

type Listener = (enabled: boolean) => void;

let cloudLinkEnabled = false;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((fn) => {
    try {
      fn(cloudLinkEnabled);
    } catch {
      // listener isolado
    }
  });
}

/** Ligado = pode sincronizar com a nuvem. */
export function isCloudLinkEnabled(): boolean {
  return cloudLinkEnabled;
}

export function setCloudLinkEnabled(next: boolean): void {
  const value = Boolean(next);
  if (cloudLinkEnabled === value) return;
  cloudLinkEnabled = value;
  notify();
}

export function subscribeCloudLink(listener: Listener): () => void {
  listeners.add(listener);
  listener(cloudLinkEnabled);
  return () => {
    listeners.delete(listener);
  };
}
