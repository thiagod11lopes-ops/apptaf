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
import { getFirestoreDb, getFirebaseAuth } from '../../config/firebase';
import { isValidAuthEmail, normalizeAuthEmail } from '../../utils/normalizeAuthEmail';
import { userAuthorizedEmailsPath } from './firestorePaths';
import { readAppMetaCache } from '../../offline-first/db/appMeta';

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
const MEMBER_UID_LOOKUP_COLLECTION = 'member_uid_lookup';

function readPersistedMemberSession(): { loginUid: string; dataOwnerUid: string } | null {
  const loginUid = readAppMetaCache('session:loginUid');
  const dataOwnerUid = readAppMetaCache('session:dataOwnerUid');
  if (!loginUid || !dataOwnerUid || loginUid === dataOwnerUid) return null;
  return { loginUid, dataOwnerUid };
}

function fallbackMemberAccessFromPersistedSession(loginUid: string): MemberAccess {
  const persisted = readPersistedMemberSession();
  if (persisted?.loginUid === loginUid) {
    return { dataOwnerUid: persisted.dataOwnerUid, isAuthorizedMember: true };
  }
  return { dataOwnerUid: loginUid, isAuthorizedMember: false };
}

export async function resolveMemberAccess(
  loginUid: string,
  email: string | null | undefined,
): Promise<MemberAccess> {
  const db = getFirestoreDb();
  if (!db) {
    return fallbackMemberAccessFromPersistedSession(loginUid);
  }

  if (email?.trim()) {
    try {
      const emailKey = normalizeAuthEmail(email);
      const snap = await getDoc(doc(db, MEMBER_LOOKUP_COLLECTION, emailKey));

      if (snap.exists()) {
        const data = snap.data() as { bossUid?: string; ativo?: boolean };
        if (data.ativo === true && data.bossUid && data.bossUid !== loginUid) {
          return { dataOwnerUid: data.bossUid, isAuthorizedMember: true };
        }
      }
    } catch {
      // Firestore indisponível ou regras ainda não publicadas — tenta lookup por UID abaixo.
    }
  }

  if (db && loginUid.trim()) {
    try {
      const uidSnap = await getDoc(doc(db, MEMBER_UID_LOOKUP_COLLECTION, loginUid));
      if (uidSnap.exists()) {
        const data = uidSnap.data() as { bossUid?: string; ativo?: boolean };
        if (data.ativo !== false && data.bossUid && data.bossUid !== loginUid) {
          return { dataOwnerUid: data.bossUid, isAuthorizedMember: true };
        }
      }
    } catch {
      // Offline ou regras indisponíveis — tenta sessão persistida.
    }
  }

  return fallbackMemberAccessFromPersistedSession(loginUid);
}

/** Registra o UID Firebase do membro autorizado (acesso à nuvem do chefe). */
export async function registerAuthorizedMemberLogin(
  bossUid: string,
  email: string,
  memberUid: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getFirestoreDb();
  if (!db || !memberUid.trim() || memberUid === bossUid) {
    return { ok: true };
  }

  const emailKey = normalizeAuthEmail(email);
  try {
    const auth = getFirebaseAuth()?.currentUser;
    if (auth) {
      await auth.getIdToken(true);
      if (!auth.email?.trim()) {
        await auth.reload();
      }
    }

    await setDoc(
      doc(db, MEMBER_LOOKUP_COLLECTION, emailKey),
      {
        memberUid,
        lastLoginAt: serverTimestamp(),
      },
      { merge: true },
    );

    await setDoc(
      doc(db, MEMBER_UID_LOOKUP_COLLECTION, memberUid),
      {
        bossUid,
        ativo: true,
        email: emailKey,
        lastLoginAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: /permission|permiss[aã]o|denied/i.test(msg)
        ? 'Permissão negada na nuvem. Use o mesmo e-mail autorizado pelo chefe.'
        : msg,
    };
  }
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

  const lookupSnap = await getDoc(doc(db, MEMBER_LOOKUP_COLLECTION, email));
  const memberUid = lookupSnap.exists()
    ? (lookupSnap.data() as { memberUid?: string }).memberUid?.trim()
    : undefined;

  const batch = writeBatch(db);
  batch.delete(doc(db, userAuthorizedEmailsPath(bossUid), email));
  batch.delete(doc(db, MEMBER_LOOKUP_COLLECTION, email));
  if (memberUid) {
    batch.delete(doc(db, MEMBER_UID_LOOKUP_COLLECTION, memberUid));
  }
  await batch.commit();
}
