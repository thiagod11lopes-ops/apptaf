/**
 * Aviso leve após renovar wraps E2E dos autorizados (chefe).
 * AuthorizedEmailsBlock escuta e mostra confirmação na UI.
 */

export type E2eWrapRenewalNotice = {
  renewed: number;
  alreadyAligned: number;
  total: number;
  source: 'sync' | 'wipe' | 'csv' | 'manual';
  message: string;
  at: number;
};

type Listener = (notice: E2eWrapRenewalNotice | null) => void;

let lastNotice: E2eWrapRenewalNotice | null = null;
const listeners = new Set<Listener>();

export function buildE2eWrapRenewalMessage(result: {
  renewed: number;
  alreadyAligned: number;
  total: number;
  dekLocked?: boolean;
}): string {
  if (result.dekLocked) {
    return 'Escudo verde necessário para renovar o acesso cifrado dos autorizados. Entre com a senha e sincronize de novo.';
  }
  if (result.total <= 0) {
    return 'Nenhum e-mail autorizado para renovar acesso cifrado.';
  }
  if (result.renewed > 0) {
    return `Acesso cifrado dos autorizados renovado (${result.renewed} de ${result.total} e-mail${result.total === 1 ? '' : 's'}).`;
  }
  return `Acesso cifrado dos autorizados confirmado (${result.total} e-mail${result.total === 1 ? '' : 's'} alinhado${result.total === 1 ? '' : 's'}).`;
}

export function publishE2eWrapRenewalNotice(
  partial: Omit<E2eWrapRenewalNotice, 'message' | 'at'> & { message?: string },
): E2eWrapRenewalNotice {
  const notice: E2eWrapRenewalNotice = {
    ...partial,
    message:
      partial.message ??
      buildE2eWrapRenewalMessage({
        renewed: partial.renewed,
        alreadyAligned: partial.alreadyAligned,
        total: partial.total,
      }),
    at: Date.now(),
  };
  lastNotice = notice;
  for (const listener of listeners) {
    try {
      listener(notice);
    } catch {
      /* ignore */
    }
  }
  return notice;
}

export function getLastE2eWrapRenewalNotice(): E2eWrapRenewalNotice | null {
  return lastNotice;
}

export function clearE2eWrapRenewalNotice(): void {
  lastNotice = null;
  for (const listener of listeners) {
    try {
      listener(null);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeE2eWrapRenewalNotice(listener: Listener): () => void {
  listeners.add(listener);
  if (lastNotice) listener(lastNotice);
  return () => {
    listeners.delete(listener);
  };
}
