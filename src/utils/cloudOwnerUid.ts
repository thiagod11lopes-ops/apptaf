/** UID válido na nuvem Supabase (coluna uuid). UIDs do Firebase antigo não passam. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCloudOwnerUid(uid: string | null | undefined): boolean {
  if (!uid?.trim()) return false;
  return UUID_RE.test(uid.trim());
}

/** Mensagem amigável quando ainda há UID legado do Firebase. */
export function legacyFirebaseUidMessage(uid: string): string {
  return (
    `UID legado do Firebase detectado (${uid.slice(0, 8)}…). ` +
    'Saia, entre novamente com e-mail/senha do Supabase e sincronize. ' +
    'Se persistir, use «Excluir todos os dados» e reimporte o CSV.'
  );
}
