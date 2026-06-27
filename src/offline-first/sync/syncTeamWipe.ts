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

async function wipeLocalOwnerBundle(ownerUid: string): Promise<void> {
  const resumo = calcularResumoInicioTafFromHistorico([], []);
  await resetCloudDataCache(ownerUid, resumo);
  await clearCloudDataCache(ownerUid);
  if (getTafDatabase()) {
    await wipeOwnerData(ownerUid);
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
