import { deleteDoc, doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { SessaoResultadoRubrica } from '../../utils/sessaoLight';
import { getFirestoreDb } from '../../config/firebase';
import { userSessaoRubricasPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';

export type SessaoRubricasDoc = {
  resultados: SessaoResultadoRubrica[];
};

export async function getSessaoRubricasFirestore(
  uid: string,
  sessaoId: string,
): Promise<SessaoRubricasDoc | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, userSessaoRubricasPath(uid), sessaoId));
  return snap.exists() ? (snap.data() as SessaoRubricasDoc) : null;
}

export async function getAllSessaoRubricasFirestore(uid: string): Promise<SessaoRubricasDoc[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, userSessaoRubricasPath(uid)));
  return snap.docs.map((d) => d.data() as SessaoRubricasDoc);
}

export async function setSessaoRubricasFirestore(
  uid: string,
  sessaoId: string,
  docData: SessaoRubricasDoc,
): Promise<void> {
  if (docData.resultados.length === 0) return;
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await setDoc(
    doc(db, userSessaoRubricasPath(uid), sessaoId),
    sanitizeForFirestore(docData),
  );
}

export async function deleteSessaoRubricasFirestore(uid: string, sessaoId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, userSessaoRubricasPath(uid), sessaoId));
}
