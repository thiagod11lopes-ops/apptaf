import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
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
