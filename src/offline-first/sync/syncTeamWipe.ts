import { clearLocalCadastros } from '../../services/cadastrosIndexedDb';
import { clearLocalSessoesAplicacao } from '../../services/resultadosAplicadosIndexedDb';
import { clearLocalAplicadores } from '../../services/aplicadoresIndexedDb';
import { clearAllPreCadastrosTaf } from '../../services/preCadastroTafStorage';
import { resetCloudDataCache, clearCloudDataCache } from '../../services/cloudDataCache';
import { calcularResumoInicioTafFromHistorico } from '../../utils/resultadoGeralHistorico';
import { getTeamWipeMarker } from './firebase/FirebaseGateway';
import { wipeOwnerData } from '../db/localDb';
import { getTafDatabase, setMeta, getMeta } from '../db/tafDatabase';
import { syncEngine, notifyDataChanged } from './SyncEngine';
import { isUnsyncedLocalStatus } from './syncStatus';

const TEAM_WIPE_ACK_PREFIX = 'teamWipeAck:';

export async function getLocalTeamWipeAck(dataOwnerUid: string): Promise<number | null> {
  const raw = await getMeta(`${TEAM_WIPE_ACK_PREFIX}${dataOwnerUid}`);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function setLocalTeamWipeAck(dataOwnerUid: string, wipedAt: number): Promise<void> {
  await setMeta(`${TEAM_WIPE_ACK_PREFIX}${dataOwnerUid}`, String(wipedAt));
}

/**
 * Após restaurar CSV/backup: reconhece o wipe remoto sem apagar o local,
 * para a próxima sync enviar os dados restaurados em vez de limpar IndexedDB.
 */
export async function acknowledgeTeamWipeAfterLocalRestore(dataOwnerUid: string): Promise<void> {
  if (!dataOwnerUid.trim()) return;
  try {
    const remoteWipedAt = await getTeamWipeMarker(dataOwnerUid);
    await setLocalTeamWipeAck(dataOwnerUid, remoteWipedAt ?? Date.now());
  } catch {
    await setLocalTeamWipeAck(dataOwnerUid, Date.now());
  }
}

async function wipeLocalOwnerBundle(ownerUid: string): Promise<void> {
  const resumo = calcularResumoInicioTafFromHistorico([], []);
  await resetCloudDataCache(ownerUid, resumo);
  await clearCloudDataCache(ownerUid);
  if (getTafDatabase()) {
    await wipeOwnerData(ownerUid);
  }
}

/** Dados locais posteriores ao wipe (ex.: CSV restaurado) — não devem ser apagados. */
async function hasLocalDataToPreserve(ownerUid: string, wipedAt: number): Promise<boolean> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return false;

  const newerThanWipe = (row: {
    deleted?: boolean;
    updatedAt?: number;
    createdAt?: number;
    syncStatus?: string;
  }): boolean => {
    if (row.deleted === true) return false;
    if (isUnsyncedLocalStatus(row.syncStatus)) return true;
    const at = Math.max(row.updatedAt ?? 0, row.createdAt ?? 0);
    return at > wipedAt;
  };

  try {
    const [cadastros, sessoes, aplicadores] = await Promise.all([
      db.cadastros.where('ownerUid').equals(ownerUid).toArray(),
      db.sessoes.where('ownerUid').equals(ownerUid).toArray(),
      db.aplicadores.where('ownerUid').equals(ownerUid).toArray(),
    ]);
    return (
      cadastros.some(newerThanWipe) ||
      sessoes.some(newerThanWipe) ||
      aplicadores.some(newerThanWipe)
    );
  } catch {
    return false;
  }
}

/** Verifica wipe remoto via Sync Engine (FirebaseGateway). */
export async function applyTeamWipeIfNeeded(
  dataOwnerUid: string,
  loginUid: string | null,
): Promise<boolean> {
  const remoteWipedAt = await getTeamWipeMarker(dataOwnerUid);
  if (!remoteWipedAt) return false;

  const localAck = await getLocalTeamWipeAck(dataOwnerUid);
  if (localAck != null && localAck >= remoteWipedAt) return false;

  // CSV/backup restaurado após wipe na nuvem: preservar local e deixar LWW enviar.
  if (await hasLocalDataToPreserve(dataOwnerUid, remoteWipedAt)) {
    await setLocalTeamWipeAck(dataOwnerUid, remoteWipedAt);
    return false;
  }
  if (loginUid && loginUid !== dataOwnerUid) {
    if (await hasLocalDataToPreserve(loginUid, remoteWipedAt)) {
      await setLocalTeamWipeAck(dataOwnerUid, remoteWipedAt);
      return false;
    }
  }

  await Promise.all([
    clearLocalCadastros(),
    clearLocalSessoesAplicacao(),
    clearLocalAplicadores(),
    clearAllPreCadastrosTaf(),
  ]);

  await wipeLocalOwnerBundle(dataOwnerUid);
  if (loginUid && loginUid !== dataOwnerUid) {
    await wipeLocalOwnerBundle(loginUid);
  }

  await syncEngine.resetAfterWipe(dataOwnerUid);
  await setLocalTeamWipeAck(dataOwnerUid, remoteWipedAt);
  notifyDataChanged();
  return true;
}
