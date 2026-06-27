/**
 * ÚNICO ponto de acesso ao Firestore para o Sync Engine.
 * Demais camadas (React, Repository, Utils) NÃO devem importar firebase/firestore.
 */
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '../../../config/firebase';

export {
  getAllCadastrosFirestoreLight,
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
  purgeCadastroFirestore,
} from '../../../services/firebase/cadastrosFirestore';

export {
  getAllSessoesFirestoreLight,
  addSessaoFirestore,
  updateSessaoFirestore,
  deleteSessaoFirestore,
  purgeSessaoFirestore,
} from '../../../services/firebase/sessoesFirestore';

export {
  getAllAplicadoresFirestore,
  addAplicadorFirestore,
  deleteAplicadorFirestore,
  purgeAplicadorFirestore,
} from '../../../services/firebase/aplicadoresFirestore';

export {
  resolveMemberAccess,
  registerAuthorizedMemberLogin,
  listAuthorizedEmails,
  addAuthorizedEmail,
  removeAuthorizedEmail,
  type AuthorizedEmailEntry,
  type MemberAccess,
} from '../../../services/firebase/authorizedEmailsFirestore';

export { getTeamWipeMarker } from '../../../services/firebase/teamWipeFirestore';

export { wipeCloudTeamDataFirestore as wipeAllCloudDataForOwner } from '../../../services/firebase/wipeCloudDataFirestore';

export async function probeFirestoreConnectivity(): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    const ref = doc(db, 'member_lookup', '__connectivity_probe__');
    await getDoc(ref);
    return true;
  } catch {
    return false;
  }
}

/** Estima horário do servidor Firebase (ms UTC) para detecção de drift. */
export async function estimateServerTimeMs(): Promise<number | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const ref = doc(db, '_sync_probe', 'clock');
    await setDoc(ref, { probe: serverTimestamp() }, { merge: true });
    const snap = await getDoc(ref);
    const probe = snap.data()?.probe as { toMillis?: () => number } | undefined;
    if (probe && typeof probe.toMillis === 'function') return probe.toMillis();
    return null;
  } catch {
    return null;
  }
}
