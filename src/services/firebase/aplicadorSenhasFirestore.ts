import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';
import { userAplicadorSenhasPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';

/**
 * Senha em texto do aplicador guardada na nuvem em coleção separada.
 * Regras do Firestore garantem que apenas o e-mail chefe pode LER;
 * membros ativos podem escrever (ao trocar a senha), mas nunca ler.
 */
export type AplicadorSenhaCloud = {
  senha: string;
  senhaHash: string;
  updatedAt: number;
};

export async function setAplicadorSenhaFirestore(
  ownerUid: string,
  id: string,
  senha: string,
  senhaHash: string,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !ownerUid || !id) return;
  await setDoc(
    doc(db, userAplicadorSenhasPath(ownerUid), id),
    sanitizeForFirestore({
      id,
      senha,
      senhaHash,
      updatedAt: Date.now(),
    }),
  );
}

/** Mapa id → senha em texto. Apenas o chefe consegue ler (regras do Firestore). */
export async function getAplicadorSenhasMapFirestore(
  ownerUid: string,
): Promise<Record<string, AplicadorSenhaCloud>> {
  const db = getFirestoreDb();
  if (!db || !ownerUid) return {};
  const snap = await getDocs(collection(db, userAplicadorSenhasPath(ownerUid)));
  const map: Record<string, AplicadorSenhaCloud> = {};
  snap.docs.forEach((docSnap) => {
    const raw = docSnap.data() as Partial<AplicadorSenhaCloud>;
    if (typeof raw.senha === 'string' && raw.senha.length > 0) {
      map[docSnap.id] = {
        senha: raw.senha,
        senhaHash: typeof raw.senhaHash === 'string' ? raw.senhaHash : '',
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
      };
    }
  });
  return map;
}

export async function deleteAplicadorSenhaFirestore(ownerUid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !ownerUid || !id) return;
  await deleteDoc(doc(db, userAplicadorSenhasPath(ownerUid), id));
}
