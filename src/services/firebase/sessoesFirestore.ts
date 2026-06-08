import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userSessoesPath } from './firestorePaths';

function sessoesCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userSessoesPath(uid));
}

export async function getAllSessoesFirestore(uid: string): Promise<SessaoAplicacaoTaf[]> {
  const snap = await getDocs(sessoesCollection(uid));
  const list = snap.docs.map((d) => d.data() as SessaoAplicacaoTaf);
  list.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return list;
}

export async function addSessaoFirestore(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await setDoc(doc(db, userSessoesPath(uid), sessao.id), sessao);
}

export async function updateSessaoFirestore(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  await addSessaoFirestore(uid, sessao);
}

export async function deleteSessaoFirestore(uid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await deleteDoc(doc(db, userSessoesPath(uid), id));
}

export async function getSessaoByIdFirestore(
  uid: string,
  id: string,
): Promise<SessaoAplicacaoTaf | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, userSessoesPath(uid), id));
  return snap.exists() ? (snap.data() as SessaoAplicacaoTaf) : null;
}
