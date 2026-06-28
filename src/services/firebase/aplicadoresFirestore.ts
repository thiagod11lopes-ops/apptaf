import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import type { AplicadorItemPersist } from '../aplicadoresIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userAplicadoresPath } from './firestorePaths';
import { sanitizeForFirestore } from './sanitizeFirestoreData';
import type { TombstonePayload } from '../../offline-first/sync/tombstone';

function aplicadoresCollection(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  return collection(db, userAplicadoresPath(uid));
}

import { stripSenhaFromAplicador, toAplicadorFirestorePayload } from '../../utils/aplicadorSyncPolicy';

/** Aplicadores do chefe — senhaHash para assinatura offline; senha em texto nunca na nuvem. */
export async function getAllAplicadoresFirestore(uid: string): Promise<AplicadorItemPersist[]> {
  const snap = await getDocs(aplicadoresCollection(uid));
  return snap.docs
    .map((docSnap) => {
      const raw = docSnap.data() as AplicadorItemPersist & { deleted?: boolean; deletedAt?: number };
      return stripSenhaFromAplicador({ ...raw, id: docSnap.id });
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function addAplicadorFirestore(uid: string, item: AplicadorItemPersist): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const docId = item.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const payload = toAplicadorFirestorePayload(item);
  await setDoc(
    doc(db, userAplicadoresPath(uid), docId),
    sanitizeForFirestore({
      id: docId,
      nip: payload.nip || '',
      nome: payload.nome || 'Sem Nome',
      categoria: payload.categoria || 'Praças',
      sexo: payload.sexo,
      oficial: payload.oficial,
      praca: payload.praca,
      senhaHash: payload.senhaHash,
      updatedAt: payload.updatedAt ?? Date.now(),
    }),
  );
}

export async function deleteAplicadorFirestore(
  uid: string,
  id: string,
  tombstone?: TombstonePayload,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  if (!id) return;

  if (tombstone) {
    await setDoc(
      doc(db, userAplicadoresPath(uid), id),
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
    return;
  }

  await deleteDoc(doc(db, userAplicadoresPath(uid), id));
}

export async function purgeAplicadorFirestore(uid: string, id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');
  if (!id) return;
  await deleteDoc(doc(db, userAplicadoresPath(uid), id));
}
