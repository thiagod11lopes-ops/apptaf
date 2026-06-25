import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';
import {
  userCadastroRubricasPath,
  userCadastrosPath,
  userSessaoRubricasPath,
  userSessoesPath,
} from './firestorePaths';

const FIRESTORE_BATCH_LIMIT = 500;

export type WipeCloudCounts = {
  cadastros: number;
  sessoes: number;
  cadastroRubricas: number;
  sessaoRubricas: number;
};

async function deleteAllInCollection(collectionPath: string): Promise<number> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const snap = await getDocs(collection(db, collectionPath));
  if (snap.empty) return 0;

  let deleted = 0;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
      deleted += 1;
    }
    await batch.commit();
  }

  return deleted;
}

/** Remove todos os cadastros, sessões e rubricas do usuário na nuvem. */
export async function wipeCloudUserDataFirestore(uid: string): Promise<WipeCloudCounts> {
  const [cadastros, sessoes, cadastroRubricas, sessaoRubricas] = await Promise.all([
    deleteAllInCollection(userCadastrosPath(uid)),
    deleteAllInCollection(userSessoesPath(uid)),
    deleteAllInCollection(userCadastroRubricasPath(uid)),
    deleteAllInCollection(userSessaoRubricasPath(uid)),
  ]);

  return { cadastros, sessoes, cadastroRubricas, sessaoRubricas };
}
