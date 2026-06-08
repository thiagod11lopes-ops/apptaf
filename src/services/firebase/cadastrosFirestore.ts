import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userCadastrosPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';
import { dedupeCadastrosPorNip } from '../../utils/dedupeCadastrosPorNip';
import {
  extractCadastroRubricas,
  hasCadastroRubricas,
  toCadastroLight,
} from '../../utils/cadastroLight';
import {
  deleteCadastroRubricasFirestore,
  setCadastroRubricasFirestore,
} from './cadastroRubricasFirestore';

function cadastrosCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userCadastrosPath(uid));
}

function scheduleRubricMigration(
  uid: string,
  raw: CadastroItemPersist,
  rubricas: ReturnType<typeof extractCadastroRubricas>,
) {
  void (async () => {
    await setCadastroRubricasFirestore(uid, raw.id, rubricas);
    const db = getFirestoreDb();
    if (!db) return;
    await setDoc(
      doc(db, userCadastrosPath(uid), raw.id),
      sanitizeForFirestore(toCadastroLight(raw)),
    );
  })().catch(() => undefined);
}

/** Uma consulta — cadastros sem SVG (carga leve). */
export async function getAllCadastrosFirestoreLight(uid: string): Promise<CadastroItemPersist[]> {
  const snap = await getDocs(cadastrosCollection(uid));
  const items: CadastroItemPersist[] = [];

  for (const docSnap of snap.docs) {
    const raw = docSnap.data() as CadastroItemPersist;
    const rubricas = extractCadastroRubricas(raw);
    const light = toCadastroLight({ ...raw, id: docSnap.id });
    items.push(light);

    if (hasCadastroRubricas(rubricas)) {
      scheduleRubricMigration(uid, { ...raw, id: docSnap.id }, rubricas);
    }
  }

  return dedupeCadastrosPorNip(items);
}

export async function getAllCadastrosFirestore(uid: string): Promise<CadastroItemPersist[]> {
  return getAllCadastrosFirestoreLight(uid);
}

async function persistCadastro(uid: string, item: CadastroItemPersist): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const rubricas = extractCadastroRubricas(item);
  const light = toCadastroLight(item);

  await setDoc(doc(db, userCadastrosPath(uid), item.id), sanitizeForFirestore(light));

  if (hasCadastroRubricas(rubricas)) {
    await setCadastroRubricasFirestore(uid, item.id, rubricas);
  } else {
    await deleteCadastroRubricasFirestore(uid, item.id);
  }
}

export async function addCadastroFirestore(uid: string, item: CadastroItemPersist): Promise<void> {
  await persistCadastro(uid, item);
}

const FIRESTORE_BATCH_LIMIT = 500;

export async function addCadastrosEmLoteFirestore(
  uid: string,
  items: CadastroItemPersist[],
): Promise<void> {
  if (items.length === 0) return;
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  for (let i = 0; i < items.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = items.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const light = toCadastroLight(item);
      batch.set(doc(db, userCadastrosPath(uid), item.id), sanitizeForFirestore(light));
    }
    await batch.commit();

    for (const item of chunk) {
      const rubricas = extractCadastroRubricas(item);
      if (hasCadastroRubricas(rubricas)) {
        await setCadastroRubricasFirestore(uid, item.id, rubricas);
      }
    }
  }
}

export async function deleteCadastroFirestore(uid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  await deleteDoc(doc(db, userCadastrosPath(uid), id));
  await deleteCadastroRubricasFirestore(uid, id);
}
