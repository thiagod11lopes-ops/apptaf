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
import { invalidateRemoteSnapshotCache } from './remoteSnapshotCache';
import { forceNextFullRemoteFetch } from './syncWatermark';

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
 *
 * IMPORTANTE: getTeamWipeMarker devolve `{ wipedAt }`, não um number.
 */
export async function acknowledgeTeamWipeAfterLocalRestore(dataOwnerUid: string): Promise<void> {
  if (!dataOwnerUid.trim()) return;
  try {
    const marker = await getTeamWipeMarker(dataOwnerUid);
    await setLocalTeamWipeAck(dataOwnerUid, marker?.wipedAt ?? Date.now());
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

/**
 * Dados locais a preservar no bootstrap/sync após wipe remoto.
 * Nuvem é a base verdadeira: dados já sincronizados são apagados.
 * Só preserva edições locais ainda não sincronizadas feitas DEPOIS do wipe
 * (ex.: restauração CSV / trabalho offline após o esvaziamento).
 */
async function hasLocalDataToPreserve(ownerUid: string, wipedAt: number): Promise<boolean> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return false;

  const shouldPreserve = (row: {
    deleted?: boolean;
    syncStatus?: string;
    updatedAt?: number;
  }): boolean => {
    if (!isUnsyncedLocalStatus(row.syncStatus)) return false;
    const at = typeof row.updatedAt === 'number' ? row.updatedAt : 0;
    return at > wipedAt;
  };

  try {
    const [cadastros, sessoes, aplicadores] = await Promise.all([
      db.cadastros.where('ownerUid').equals(ownerUid).toArray(),
      db.sessoes.where('ownerUid').equals(ownerUid).toArray(),
      db.aplicadores.where('ownerUid').equals(ownerUid).toArray(),
    ]);
    return (
      cadastros.some(shouldPreserve) ||
      sessoes.some(shouldPreserve) ||
      aplicadores.some(shouldPreserve)
    );
  } catch {
    return false;
  }
}

/**
 * Verifica wipe remoto via Sync Engine (FirebaseGateway).
 *
 * IMPORTANTE: getTeamWipeMarker devolve `{ wipedAt }`, não um number.
 * Comparar o objeto direto quebrava o ack e limpava o local a cada sync.
 */
export async function applyTeamWipeIfNeeded(
  dataOwnerUid: string,
  loginUid: string | null,
): Promise<boolean> {
  const marker = await getTeamWipeMarker(dataOwnerUid);
  if (!marker) return false;
  const remoteWipedAt = Number(marker.wipedAt) || 0;
  if (remoteWipedAt <= 0) return false;

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

  console.info('[sync] Aplicando team wipe local (marcador remoto mais recente)', {
    dataOwnerUid,
    remoteWipedAt,
    localAck,
  });

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
  invalidateRemoteSnapshotCache();
  await forceNextFullRemoteFetch(dataOwnerUid);
  await setLocalTeamWipeAck(dataOwnerUid, remoteWipedAt);
  notifyDataChanged();
  return true;
}
