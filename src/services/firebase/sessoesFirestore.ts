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
import { sanitizeForFirestore } from './sanitizeFirestoreData';
import { extractSessaoRubricas, toSessaoLight } from '../../utils/sessaoLight';
import {
  deleteSessaoRubricasFirestore,
  setSessaoRubricasFirestore,
} from './sessaoRubricasFirestore';

function sessoesCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userSessoesPath(uid));
}

function scheduleSessaoRubricMigration(uid: string, sessao: SessaoAplicacaoTaf) {
  const rubricas = extractSessaoRubricas(sessao);
  if (rubricas.length === 0) return;
  void (async () => {
    await setSessaoRubricasFirestore(uid, sessao.id, { resultados: rubricas });
    const db = getFirestoreDb();
    if (!db) return;
    await setDoc(doc(db, userSessoesPath(uid), sessao.id), sanitizeForFirestore(toSessaoLight(sessao)));
  })().catch(() => undefined);
}

/** Uma consulta — sessões sem SVG nos resultados. */
export async function getAllSessoesFirestoreLight(uid: string): Promise<SessaoAplicacaoTaf[]> {
  const snap = await getDocs(sessoesCollection(uid));
  const list: SessaoAplicacaoTaf[] = [];

  for (const docSnap of snap.docs) {
    const raw = docSnap.data() as SessaoAplicacaoTaf;
    const sessao = { ...raw, id: docSnap.id };
    list.push(toSessaoLight(sessao));

    if (extractSessaoRubricas(sessao).length > 0) {
      scheduleSessaoRubricMigration(uid, sessao);
    }
  }

  list.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return list;
}

export async function getAllSessoesFirestore(uid: string): Promise<SessaoAplicacaoTaf[]> {
  return getAllSessoesFirestoreLight(uid);
}

async function persistSessao(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const rubricas = extractSessaoRubricas(sessao);
  const light = toSessaoLight(sessao);

  await setDoc(doc(db, userSessoesPath(uid), sessao.id), sanitizeForFirestore(light));

  if (rubricas.length > 0) {
    await setSessaoRubricasFirestore(uid, sessao.id, { resultados: rubricas });
  } else {
    await deleteSessaoRubricasFirestore(uid, sessao.id);
  }
}

export async function addSessaoFirestore(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  await persistSessao(uid, sessao);
}

export async function updateSessaoFirestore(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  await persistSessao(uid, sessao);
}

export async function deleteSessaoFirestore(uid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await deleteDoc(doc(db, userSessoesPath(uid), id));
  await deleteSessaoRubricasFirestore(uid, id);
}

export async function getSessaoByIdFirestore(
  uid: string,
  id: string,
): Promise<SessaoAplicacaoTaf | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, userSessoesPath(uid), id));
  return snap.exists() ? toSessaoLight(snap.data() as SessaoAplicacaoTaf) : null;
}
