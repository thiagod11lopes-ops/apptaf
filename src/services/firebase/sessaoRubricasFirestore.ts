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

export async function getAllSessaoRubricasFirestoreMap(
  uid: string,
): Promise<Map<string, SessaoRubricasDoc>> {
  const db = getFirestoreDb();
  const map = new Map<string, SessaoRubricasDoc>();
  if (!db) return map;
  const snap = await getDocs(collection(db, userSessaoRubricasPath(uid)));
  for (const docSnap of snap.docs) {
    map.set(docSnap.id, docSnap.data() as SessaoRubricasDoc);
  }
  return map;
}

/** @deprecated use getAllSessaoRubricasFirestoreMap */
export async function getAllSessaoRubricasFirestore(uid: string): Promise<SessaoRubricasDoc[]> {
  return [...(await getAllSessaoRubricasFirestoreMap(uid)).values()];
}

const RUBRIC_BATCH_THRESHOLD = 4;

export async function fetchSessaoRubricasForIds(
  uid: string,
  ids: string[],
): Promise<Map<string, SessaoRubricasDoc>> {
  if (ids.length === 0) return new Map();
  if (ids.length <= RUBRIC_BATCH_THRESHOLD) {
    const pairs = await Promise.all(
      ids.map(async (id) => {
        const rub = await getSessaoRubricasFirestore(uid, id);
        return rub ? ([id, rub] as const) : null;
      }),
    );
    return new Map(pairs.filter((p): p is [string, SessaoRubricasDoc] => p != null));
  }
  const all = await getAllSessaoRubricasFirestoreMap(uid);
  const picked = new Map<string, SessaoRubricasDoc>();
  for (const id of ids) {
    const rub = all.get(id);
    if (rub) picked.set(id, rub);
  }
  return picked;
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
