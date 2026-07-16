/** E-mail normalizado (minúsculas, sem espaços). */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Domínio institucional aceito no login / cadastro / recuperação. */
export const ALLOWED_AUTH_EMAIL_DOMAIN = 'marinha.mil.br';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAuthEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeAuthEmail(email));
}

/** E-mail válido e no domínio @marinha.mil.br. */
export function isAllowedAuthEmail(email: string): boolean {
  const normalized = normalizeAuthEmail(email);
  if (!isValidAuthEmail(normalized)) return false;
  return normalized.endsWith(`@${ALLOWED_AUTH_EMAIL_DOMAIN}`);
}

export function authEmailDomainErrorMessage(): string {
  return `Use um e-mail @${ALLOWED_AUTH_EMAIL_DOMAIN}.`;
}

/** Lança se o e-mail não for do domínio permitido. */
export function assertAllowedAuthEmail(email: string): string {
  const normalized = normalizeAuthEmail(email);
  if (!isAllowedAuthEmail(normalized)) {
    throw new Error(authEmailDomainErrorMessage());
  }
  return normalized;
}
