/**
 * ÚNICO ponto de acesso ao Firestore para o Sync Engine.
 * Demais camadas (React, Repository, Utils) NÃO devem importar firebase/firestore.
 */
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from '../../../config/firebase';

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

/** Verifica conectividade lendo um doc sob users/{uid} (permitido pelas rules mesmo inexistente). */
export type FirestoreProbeResult = {
  ok: boolean;
  reason?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function probeFirestoreConnectivityDetailed(
  ownerUid?: string,
): Promise<FirestoreProbeResult> {
  const db = getFirestoreDb();
  const authUser = getFirebaseAuth()?.currentUser;
  if (!db) return { ok: false, reason: 'Firestore indisponível.' };
  if (!authUser) return { ok: false, reason: 'Sessão Google não encontrada.' };

  try {
    await authUser.getIdToken(true);
  } catch {
    return { ok: false, reason: 'Token de autenticação expirado. Entre novamente com Google.' };
  }

  const uids = [...new Set([ownerUid?.trim(), authUser.uid].filter(Boolean))] as string[];
  let lastReason = 'Não foi possível conectar ao Firebase.';

  for (const uid of uids) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const ref = doc(db, 'users', uid, 'cadastros', '__connectivity_probe__');
        await getDoc(ref);
        return { ok: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/permission|permiss[aã]o|denied|insufficient/i.test(msg)) {
          lastReason = 'Permissão negada na nuvem. Verifique se sua conta está autorizada.';
        } else if (/offline|unavailable|network|failed/i.test(msg)) {
          lastReason = 'Sem conexão com o Firebase. Verifique a internet e tente novamente.';
        } else if (msg.trim()) {
          lastReason = msg;
        }
        if (attempt < 2) await sleep(400 * (attempt + 1));
      }
    }
  }

  return { ok: false, reason: lastReason };
}

export async function probeFirestoreConnectivity(ownerUid?: string): Promise<boolean> {
  const result = await probeFirestoreConnectivityDetailed(ownerUid);
  return result.ok;
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
