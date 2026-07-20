import {
  getLocalCadastros,
  getLocalAplicadores,
  getLocalSessoes,
  getLocalPreCadastros,
} from '../db/localDb';
import { getTeamWipeMarker } from './firebase/FirebaseGateway';
import { wipeOwnerData } from '../db/localDb';
import { clearLocalCadastros } from '../../services/localCadastrosStore';
import { pullCloudReplicaIntoLocal } from './pullCloudReplica';
import { getMeta, setMeta } from '../db/metaStore';

function teamWipeAckKey(ownerUid: string): string {
  return `teamWipeAck:${ownerUid}`;
}

export async function getLocalTeamWipeAck(ownerUid: string): Promise<number | null> {
  const raw = await getMeta(teamWipeAckKey(ownerUid));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function setLocalTeamWipeAck(ownerUid: string, wipedAt: number): Promise<void> {
  await setMeta(teamWipeAckKey(ownerUid), String(wipedAt));
}

/**
 * Após restaurar CSV (ou outro bootstrap local): marca o wipe remoto como
 * reconhecido sem apagar o IndexedDB, para a próxima sync não limpar tudo.
 */
export async function ackRemoteWipeWithoutClearingLocal(dataOwnerUid: string): Promise<void> {
  try {
    const marker = await getTeamWipeMarker(dataOwnerUid);
    await setLocalTeamWipeAck(dataOwnerUid, marker?.wipedAt ?? Date.now());
  } catch {
    await setLocalTeamWipeAck(dataOwnerUid, Date.now());
  }
}

function hasUnsyncedLocalEditsAfter(
  rows: Array<{ syncStatus?: string; updatedAt?: number }>,
  wipedAt: number,
): boolean {
  return rows.some((row) => {
    const status = String(row.syncStatus || '').toLowerCase();
    if (status === 'synced') return false;
    const at = Number(row.updatedAt) || 0;
    return at > wipedAt;
  });
}

/**
 * Preserva dados locais só se houver edições ainda não sincronizadas
 * posteriores ao wipe remoto. Dados já sincronizados (ex.: CSV restaurado e
 * enviado) não bloqueiam o wipe intencional da equipe.
 */
async function hasLocalDataToPreserve(ownerUid: string, wipedAt: number): Promise<boolean> {
  const [cads, apps, sess, prec] = await Promise.all([
    getLocalCadastros(ownerUid),
    getLocalAplicadores(ownerUid),
    getLocalSessoes(ownerUid),
    getLocalPreCadastros(ownerUid),
  ]);
  return (
    hasUnsyncedLocalEditsAfter(cads, wipedAt) ||
    hasUnsyncedLocalEditsAfter(apps, wipedAt) ||
    hasUnsyncedLocalEditsAfter(sess, wipedAt) ||
    hasUnsyncedLocalEditsAfter(prec, wipedAt)
  );
}

/**
 * Se a nuvem tem marcador de wipe mais recente que o ack local,
 * limpa IndexedDB e baixa o estado remoto (vazio ou reconstruído).
 * Retorna true se o wipe foi aplicado.
 *
 * IMPORTANTE: getTeamWipeMarker devolve `{ wipedAt }`, não um number.
 * Comparar o objeto direto quebrava o ack e limpava o local a cada sync.
 */
export async function applyTeamWipeIfNeeded(
  dataOwnerUid: string,
  loginUid?: string | null,
): Promise<boolean> {
  const marker = await getTeamWipeMarker(dataOwnerUid);
  if (!marker) return false;
  const remoteWipedAt = Number(marker.wipedAt) || 0;
  if (remoteWipedAt <= 0) return false;

  const localAck = await getLocalTeamWipeAck(dataOwnerUid);
  if (localAck != null && localAck >= remoteWipedAt) return false;

  // Há dados locais posteriores ao wipe e ainda não sincronizados?
  // Nesse caso, não apagar: marcar ack e deixar a sync enviar o que falta.
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

  await wipeOwnerData(dataOwnerUid);
  // Limpa também o store legado (localCadastrosStore), senão a UI pode
  // continuar mostrando cadastros órfãos após o wipe da nuvem.
  try {
    await clearLocalCadastros();
  } catch {
    /* ignore */
  }
  if (loginUid && loginUid !== dataOwnerUid) {
    await wipeOwnerData(loginUid);
  }

  // Replica o estado remoto (vazio ou reconstruído) para o IndexedDB.
  await pullCloudReplicaIntoLocal(dataOwnerUid);
  await setLocalTeamWipeAck(dataOwnerUid, remoteWipedAt);
  return true;
}
