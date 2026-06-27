import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import type { CadastroRubricas } from '../../utils/cadastroLight';
import { getFirestoreDb } from '../../config/firebase';
import { userCadastroRubricasPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';

export async function getCadastroRubricasFirestore(
  uid: string,
  cadastroId: string,
): Promise<CadastroRubricas | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, userCadastroRubricasPath(uid), cadastroId));
  return snap.exists() ? (snap.data() as CadastroRubricas) : null;
}

const RUBRIC_BATCH_THRESHOLD = 4;

export async function getAllCadastroRubricasFirestoreMap(
  uid: string,
): Promise<Map<string, CadastroRubricas>> {
  const db = getFirestoreDb();
  const map = new Map<string, CadastroRubricas>();
  if (!db) return map;
  const snap = await getDocs(collection(db, userCadastroRubricasPath(uid)));
  for (const docSnap of snap.docs) {
    map.set(docSnap.id, docSnap.data() as CadastroRubricas);
  }
  return map;
}

/** Poucos IDs → getDoc paralelo; muitos → uma leitura da coleção. */
export async function fetchCadastroRubricasForIds(
  uid: string,
  ids: string[],
): Promise<Map<string, CadastroRubricas>> {
  if (ids.length === 0) return new Map();
  if (ids.length <= RUBRIC_BATCH_THRESHOLD) {
    const pairs = await Promise.all(
      ids.map(async (id) => {
        const rub = await getCadastroRubricasFirestore(uid, id);
        return rub ? ([id, rub] as const) : null;
      }),
    );
    return new Map(pairs.filter((p): p is [string, CadastroRubricas] => p != null));
  }
  const all = await getAllCadastroRubricasFirestoreMap(uid);
  const picked = new Map<string, CadastroRubricas>();
  for (const id of ids) {
    const rub = all.get(id);
    if (rub) picked.set(id, rub);
  }
  return picked;
}

export async function setCadastroRubricasFirestore(
  uid: string,
  cadastroId: string,
  rubricas: CadastroRubricas,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await setDoc(
    doc(db, userCadastroRubricasPath(uid), cadastroId),
    sanitizeForFirestore(rubricas),
  );
}

export async function deleteCadastroRubricasFirestore(
  uid: string,
  cadastroId: string,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, userCadastroRubricasPath(uid), cadastroId));
}
