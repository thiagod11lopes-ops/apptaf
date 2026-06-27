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
import type { TombstonePayload } from '../../offline-first/sync/tombstone';
import { extractSessaoRubricas, toSessaoLight } from '../../utils/sessaoLight';
import { stampSessao } from '../offline/recordTimestamps';
import {
  deleteSessaoRubricasFirestore,
  setSessaoRubricasFirestore,
} from './sessaoRubricasFirestore';

function sessoesCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userSessoesPath(uid));
}

/** Uma consulta — sessões sem SVG nos resultados. */
export async function getAllSessoesFirestoreLight(uid: string): Promise<SessaoAplicacaoTaf[]> {
  const snap = await getDocs(sessoesCollection(uid));
  const list: SessaoAplicacaoTaf[] = [];

  for (const docSnap of snap.docs) {
    const raw = docSnap.data() as SessaoAplicacaoTaf & { deleted?: boolean; deletedAt?: number };
    list.push(toSessaoLight({ ...raw, id: docSnap.id }));
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

  const stamped = stampSessao(sessao, sessao.updatedAt);
  const rubricas = extractSessaoRubricas(stamped);
  const light = toSessaoLight(stamped);

  await setDoc(
    doc(db, userSessoesPath(uid), stamped.id),
    sanitizeForFirestore({ ...light, updatedAt: stamped.updatedAt }),
  );

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

export async function deleteSessaoFirestore(uid: string, id: string, tombstone?: TombstonePayload): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  if (tombstone) {
    await setDoc(
      doc(db, userSessoesPath(uid), id),
      sanitizeForFirestore({
        id,
        updatedAt: tombstone.updatedAt,
        deleted: true,
        deletedAt: tombstone.deletedAt ?? tombstone.updatedAt,
        deletedBy: tombstone.deletedBy,
        syncVersion: tombstone.syncVersion,
        updatedBy: tombstone.updatedBy,
        deviceId: tombstone.deviceId,
      }),
      { merge: true },
    );
    await deleteSessaoRubricasFirestore(uid, id);
    return;
  }

  await deleteDoc(doc(db, userSessoesPath(uid), id));
  await deleteSessaoRubricasFirestore(uid, id);
}

export async function purgeSessaoFirestore(uid: string, id: string): Promise<void> {
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
