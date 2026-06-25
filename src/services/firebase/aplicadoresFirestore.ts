import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import type { AplicadorItemPersist } from '../aplicadoresIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userAplicadoresPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';

function aplicadoresCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userAplicadoresPath(uid));
}

/** Aplicadores do chefe — inclui senhaHash para assinatura offline nos e-mails autorizados. */
export async function getAllAplicadoresFirestore(uid: string): Promise<AplicadorItemPersist[]> {
  const snap = await getDocs(aplicadoresCollection(uid));
  return snap.docs
    .map((docSnap) => {
      const raw = docSnap.data() as AplicadorItemPersist;
      return { ...raw, id: docSnap.id };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function addAplicadorFirestore(uid: string, item: AplicadorItemPersist): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  await setDoc(
    doc(db, userAplicadoresPath(uid), item.id),
    sanitizeForFirestore({
      nip: item.nip,
      nome: item.nome,
      categoria: item.categoria,
      sexo: item.sexo,
      oficial: item.oficial,
      praca: item.praca,
      senhaHash: item.senhaHash,
      updatedAt: item.updatedAt ?? Date.now(),
    }),
  );
}

export async function deleteAplicadorFirestore(uid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await deleteDoc(doc(db, userAplicadoresPath(uid), id));
}
