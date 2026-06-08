import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userCadastrosPath } from './firestorePaths';

function cadastrosCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userCadastrosPath(uid));
}

export async function getAllCadastrosFirestore(uid: string): Promise<CadastroItemPersist[]> {
  const snap = await getDocs(cadastrosCollection(uid));
  return snap.docs.map((d) => d.data() as CadastroItemPersist);
}

export async function addCadastroFirestore(uid: string, item: CadastroItemPersist): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await setDoc(doc(db, userCadastrosPath(uid), item.id), item);
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
      batch.set(doc(db, userCadastrosPath(uid), item.id), item);
    }
    await batch.commit();
  }
}

export async function deleteCadastroFirestore(uid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await deleteDoc(doc(db, userCadastrosPath(uid), id));
}
