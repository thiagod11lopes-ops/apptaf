import { getCachedDataOwnerUid, getCachedLoginUid, waitForAuthenticatedUid } from './firebase/authUid';
import {
  listPreCadastros,
  migratePreCadastrosFromAppMeta,
  preCadastroRecordToTaf,
  savePreCadastroRecord,
  softDeletePreCadastroRecord,
  wipePreCadastrosForOwner,
} from '../offline-first/db/preCadastroLocalDb';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';

export const MAX_PRE_CADASTRO_PARTICIPANTES = 15;

export type PreCadastroParticipante = {
  nip: string;
  nomeMilitar: string;
  dataNascimento: string;
  sexo?: 'M' | 'F';
};

export type PreCadastroTaf = {
  id: string;
  criadoEm: number;
  tipoProva: 'corrida' | 'natacao' | 'permanencia' | 'caminhada';
  participantes: PreCadastroParticipante[];
};

async function resolveOwnerUid(): Promise<string> {
  const uid = getCachedDataOwnerUid() ?? (await waitForAuthenticatedUid());
  return uid ?? '__local__';
}

export async function getAllPreCadastrosTaf(): Promise<PreCadastroTaf[]> {
  const ownerUid = await resolveOwnerUid();
  await migratePreCadastrosFromAppMeta(ownerUid);
  const rows = await listPreCadastros(ownerUid);
  return rows.map(preCadastroRecordToTaf);
}

export async function addPreCadastroTaf(item: PreCadastroTaf): Promise<void> {
  const ownerUid = await resolveOwnerUid();
  const userId = getCachedLoginUid();
  await savePreCadastroRecord(item, ownerUid, userId);
  notifyDataChanged();
}

export async function removePreCadastroTaf(id: string): Promise<boolean> {
  const ownerUid = await resolveOwnerUid();
  const userId = getCachedLoginUid();
  const rows = await listPreCadastros(ownerUid, true);
  if (!rows.some((r) => r.id === id)) return false;
  await softDeletePreCadastroRecord(id, ownerUid, userId);
  notifyDataChanged();
  return true;
}

export async function clearAllPreCadastrosTaf(): Promise<void> {
  try {
    const uid = getCachedDataOwnerUid();
    const keys = new Set(['__local__']);
    if (uid) keys.add(uid);
    await Promise.all([...keys].map((ownerKey) => wipePreCadastrosForOwner(ownerKey)));
  } catch {
    // silencioso
  }
}
