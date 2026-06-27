import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import type { PreCadastroRecord } from '../../offline-first/types';
import { getFirestoreDb } from '../../config/firebase';
import { userPreCadastrosPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';
import type { TombstonePayload } from '../../offline-first/sync/tombstone';

function preCadastrosCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userPreCadastrosPath(uid));
}

export async function getAllPreCadastrosFirestore(uid: string): Promise<PreCadastroRecord[]> {
  const snap = await getDocs(preCadastrosCollection(uid));
  const items: PreCadastroRecord[] = [];
  for (const docSnap of snap.docs) {
    const raw = docSnap.data() as PreCadastroRecord & { deleted?: boolean };
    items.push({ ...raw, id: docSnap.id, ownerUid: uid });
  }
  return items;
}

export async function addPreCadastroFirestore(uid: string, item: PreCadastroRecord): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  const payload = sanitizeForFirestore({
    id: item.id,
    criadoEm: item.criadoEm,
    tipoProva: item.tipoProva,
    participantes: item.participantes,
    updatedAt: item.updatedAt,
    syncVersion: item.syncVersion ?? item.version,
    deleted: item.deleted === true,
    deletedAt: item.deletedAt,
    deletedBy: item.deletedBy,
    deviceId: item.deviceId,
    updatedBy: item.updatedBy,
  });
  await setDoc(doc(db, userPreCadastrosPath(uid), item.id), payload);
}

export async function deletePreCadastroFirestore(
  uid: string,
  id: string,
  tombstone?: TombstonePayload,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  if (tombstone) {
    await setDoc(
      doc(db, userPreCadastrosPath(uid), id),
      sanitizeForFirestore({
        id,
        criadoEm: tombstone.updatedAt,
        tipoProva: 'corrida',
        participantes: [],
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
    return;
  }
  await deleteDoc(doc(db, userPreCadastrosPath(uid), id));
}
