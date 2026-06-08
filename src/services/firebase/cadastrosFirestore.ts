import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userCadastrosPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';
import { dedupeCadastrosPorNip } from '../../utils/dedupeCadastrosPorNip';

function cadastrosCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userCadastrosPath(uid));
}

const CADASTROS_PAGE_SIZE = 250;

export type CadastrosLoadProgress = {
  loaded: number;
  isLastBatch: boolean;
};

export async function getAllCadastrosFirestoreWithProgress(
  uid: string,
  onProgress?: (progress: CadastrosLoadProgress) => void,
): Promise<CadastroItemPersist[]> {
  const items: CadastroItemPersist[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  onProgress?.({ loaded: 0, isLastBatch: false });

  while (true) {
    const base = cadastrosCollection(uid);
    const q = lastDoc
      ? query(base, orderBy(documentId()), startAfter(lastDoc), limit(CADASTROS_PAGE_SIZE))
      : query(base, orderBy(documentId()), limit(CADASTROS_PAGE_SIZE));

    const snap = await getDocs(q);
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      items.push(docSnap.data() as CadastroItemPersist);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    const isLastBatch = snap.docs.length < CADASTROS_PAGE_SIZE;
    onProgress?.({ loaded: items.length, isLastBatch });

    if (isLastBatch) break;
  }

  return dedupeCadastrosPorNip(items);
}

export async function getAllCadastrosFirestore(uid: string): Promise<CadastroItemPersist[]> {
  return getAllCadastrosFirestoreWithProgress(uid);
}

export async function addCadastroFirestore(uid: string, item: CadastroItemPersist): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await setDoc(doc(db, userCadastrosPath(uid), item.id), sanitizeForFirestore(item));
}

const FIRESTORE_BATCH_LIMIT = 500;

export async function addCadastrosEmLoteFirestore(
  uid: string,
  items: CadastroItemPersist[],
): Promise<void> {
  if (items.length === 0) return;
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  for (let i = 0; i < items.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = items.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(doc(db, userCadastrosPath(uid), item.id), sanitizeForFirestore(item));
    }
    await batch.commit();
  }
}

export async function deleteCadastroFirestore(uid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await deleteDoc(doc(db, userCadastrosPath(uid), id));
}
