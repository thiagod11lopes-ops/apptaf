import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';
import { isValidAuthEmail, normalizeAuthEmail } from '../../utils/normalizeAuthEmail';
import { userAuthorizedEmailsPath } from './firestorePaths';

export type AuthorizedEmailEntry = {
  email: string;
  ativo: boolean;
  criadoEm?: unknown;
};

export type MemberAccess = {
  dataOwnerUid: string;
  isAuthorizedMember: boolean;
};

const MEMBER_LOOKUP_COLLECTION = 'member_lookup';

export async function resolveMemberAccess(
  loginUid: string,
  email: string | null | undefined,
): Promise<MemberAccess> {
  if (!email?.trim()) {
    return { dataOwnerUid: loginUid, isAuthorizedMember: false };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { dataOwnerUid: loginUid, isAuthorizedMember: false };
  }

  const emailKey = normalizeAuthEmail(email);
  const snap = await getDoc(doc(db, MEMBER_LOOKUP_COLLECTION, emailKey));

  if (!snap.exists()) {
    return { dataOwnerUid: loginUid, isAuthorizedMember: false };
  }

  const data = snap.data() as { bossUid?: string; ativo?: boolean };
  if (data.ativo !== true || !data.bossUid || data.bossUid === loginUid) {
    return { dataOwnerUid: loginUid, isAuthorizedMember: false };
  }

  return { dataOwnerUid: data.bossUid, isAuthorizedMember: true };
}

/** Registra o UID Firebase do membro autorizado (para limpeza total na nuvem). */
export async function registerAuthorizedMemberLogin(
  bossUid: string,
  email: string,
  memberUid: string,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !memberUid.trim() || memberUid === bossUid) return;

  const emailKey = normalizeAuthEmail(email);
  await setDoc(
    doc(db, MEMBER_LOOKUP_COLLECTION, emailKey),
    {
      memberUid,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** UIDs de login dos e-mails autorizados que já entraram pelo menos uma vez. */
export async function listMemberLoginUidsForBoss(bossUid: string): Promise<string[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const snap = await getDocs(query(collection(db, MEMBER_LOOKUP_COLLECTION), where('bossUid', '==', bossUid)));
  const uids = new Set<string>();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as { memberUid?: string; ativo?: boolean };
    if (data.ativo === false) continue;
    const memberUid = data.memberUid?.trim();
    if (memberUid && memberUid !== bossUid) uids.add(memberUid);
  }
  return [...uids];
}

export async function listAuthorizedEmails(bossUid: string): Promise<AuthorizedEmailEntry[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const snap = await getDocs(collection(db, userAuthorizedEmailsPath(bossUid)));
  return snap.docs
    .map((d) => {
      const raw = d.data() as AuthorizedEmailEntry;
      return { email: raw.email ?? d.id, ativo: raw.ativo !== false };
    })
    .filter((e) => e.ativo)
    .sort((a, b) => a.email.localeCompare(b.email, 'pt-BR'));
}

export async function addAuthorizedEmail(bossUid: string, rawEmail: string): Promise<void> {
  const email = normalizeAuthEmail(rawEmail);
  if (!isValidAuthEmail(email)) {
    throw new Error('Informe um e-mail válido.');
  }

  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const batch = writeBatch(db);
  const authRef = doc(db, userAuthorizedEmailsPath(bossUid), email);
  const lookupRef = doc(db, MEMBER_LOOKUP_COLLECTION, email);

  batch.set(authRef, {
    email,
    ativo: true,
    criadoEm: serverTimestamp(),
  });
  batch.set(lookupRef, {
    email,
    bossUid,
    ativo: true,
    criadoEm: serverTimestamp(),
  });

  await batch.commit();
}

export async function removeAuthorizedEmail(bossUid: string, rawEmail: string): Promise<void> {
  const email = normalizeAuthEmail(rawEmail);
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const batch = writeBatch(db);
  batch.delete(doc(db, userAuthorizedEmailsPath(bossUid), email));
  batch.delete(doc(db, MEMBER_LOOKUP_COLLECTION, email));
  await batch.commit();
}
