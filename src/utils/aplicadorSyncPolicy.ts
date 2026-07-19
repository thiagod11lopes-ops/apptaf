import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';
import type { AplicadorRecord } from '../offline-first/types';
import {
  getCachedDataOwnerUid,
  getCachedLoginUid,
  isPersistedAuthorizedMemberSession,
} from '../services/firebase/authUid';

/** Membro autorizado: loginUid ≠ dataOwnerUid (chefe). */
export function isAuthorizedMemberSession(): boolean {
  const login = getCachedLoginUid();
  const owner = getCachedDataOwnerUid();
  if (login && owner && login !== owner) return true;
  return isPersistedAuthorizedMemberSession();
}

export function isBossDataSession(): boolean {
  return !isAuthorizedMemberSession();
}

/** Subconjunto local para assinatura offline (sem senha em texto). */
export type AplicadorAssinaturaPersist = Pick<
  AplicadorItemPersist,
  'id' | 'nip' | 'nome' | 'categoria' | 'oficial' | 'praca' | 'senhaHash' | 'rubricaSvg' | 'updatedAt'
>;

export function stripSenhaFromAplicador<T extends AplicadorItemPersist>(item: T): T {
  const copy = { ...item } as T & { senha?: string };
  delete copy.senha;
  return copy;
}

export function toAplicadorMemberView(item: AplicadorItemPersist): AplicadorAssinaturaPersist {
  const base = stripSenhaFromAplicador(item);
  return {
    id: base.id,
    nip: base.nip || '',
    nome: base.nome || '',
    categoria: base.categoria || 'Praças',
    oficial: base.oficial,
    praca: base.praca,
    senhaHash: base.senhaHash,
    rubricaSvg: base.rubricaSvg,
    updatedAt: base.updatedAt,
  };
}

/** Payload enviado ao Firestore — nunca inclui senha em texto. */
export function toAplicadorFirestorePayload(item: AplicadorItemPersist): AplicadorItemPersist {
  return stripSenhaFromAplicador(item);
}

export function aplicadorBusinessSnapshot(item: AplicadorItemPersist): Record<string, string | undefined> {
  const view = toAplicadorMemberView(item);
  return {
    nip: view.nip?.trim() || undefined,
    nome: view.nome?.trim() || undefined,
    categoria: view.categoria,
    oficial: view.oficial?.trim() || undefined,
    praca: view.praca?.trim() || undefined,
    senhaHash: view.senhaHash?.trim() || undefined,
    rubricaSvg: view.rubricaSvg?.trim() || undefined,
  };
}

export function aplicadorBusinessContentEqual(a: AplicadorItemPersist, b: AplicadorItemPersist): boolean {
  return JSON.stringify(aplicadorBusinessSnapshot(a)) === JSON.stringify(aplicadorBusinessSnapshot(b));
}

/** Após download remoto: chefe preserva senha local; membro recebe só o subconjunto. */
export function mergeAplicadorAfterRemoteDownload(
  remote: AplicadorItemPersist,
  existing: AplicadorRecord | undefined,
  isMember: boolean,
): AplicadorItemPersist {
  const remoteClean = stripSenhaFromAplicador(remote);
  if (isMember) {
    return toAplicadorMemberView(remoteClean);
  }
  return {
    ...remoteClean,
    senha: existing?.senha,
  };
}

/**
 * Verdadeiro quando a diferença entre o registro local e o remoto é apenas de
 * senha (senhaHash) — identidade (nip/nome/categoria) inalterada e nenhum dos
 * dois marcado como excluído. Usado para liberar o upload de troca de senha por
 * membros autorizados, mantendo o bloqueio das demais escritas em aplicadores.
 */
export function isMemberAplicadorSenhaChange(
  local: Partial<AplicadorItemPersist> & { deleted?: boolean } | null | undefined,
  remote: Partial<AplicadorItemPersist> & { deleted?: boolean } | null | undefined,
): boolean {
  if (!local || !remote) return false;
  if (local.deleted || remote.deleted) return false;
  return (
    (local.nip ?? '') === (remote.nip ?? '') &&
    (local.nome ?? '') === (remote.nome ?? '') &&
    (local.categoria ?? '') === (remote.categoria ?? '')
  );
}

export function sanitizeAplicadorForDisplay(
  item: AplicadorItemPersist,
  isMember = isAuthorizedMemberSession(),
): AplicadorItemPersist {
  return isMember ? toAplicadorMemberView(item) : item;
}
