/** E-mail normalizado para IDs no Firestore (minúsculas, sem espaços). */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAuthEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeAuthEmail(email));
}
