import { getCachedDataOwnerUid, waitForAuthenticatedUid } from './firebase/authUid';
import {
  hydrateAppMetaFromIndexedDb,
  preCadastroMetaKey,
  readAppMeta,
  removeAppMeta,
  writeAppMeta,
} from '../offline-first/db/appMeta';

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
  tipoProva: 'corrida' | 'natacao' | 'permanencia';
  participantes: PreCadastroParticipante[];
};

async function ownerStorageKey(): Promise<string> {
  const uid = getCachedDataOwnerUid() ?? (await waitForAuthenticatedUid());
  return uid ?? 'local';
}

function parsePreCadastros(raw: string | null): PreCadastroTaf[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PreCadastroTaf[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readPreCadastrosForOwner(ownerKey: string): Promise<PreCadastroTaf[]> {
  await hydrateAppMetaFromIndexedDb();
  const raw = await readAppMeta(preCadastroMetaKey(ownerKey));
  return parsePreCadastros(raw);
}

async function writePreCadastrosForOwner(ownerKey: string, list: PreCadastroTaf[]): Promise<void> {
  await writeAppMeta(preCadastroMetaKey(ownerKey), JSON.stringify(list));
}

export async function getAllPreCadastrosTaf(): Promise<PreCadastroTaf[]> {
  const ownerKey = await ownerStorageKey();
  return readPreCadastrosForOwner(ownerKey);
}

export async function addPreCadastroTaf(item: PreCadastroTaf): Promise<void> {
  const ownerKey = await ownerStorageKey();
  const list = await readPreCadastrosForOwner(ownerKey);
  list.unshift(item);
  await writePreCadastrosForOwner(ownerKey, list);
}

export async function removePreCadastroTaf(id: string): Promise<boolean> {
  const ownerKey = await ownerStorageKey();
  const list = await readPreCadastrosForOwner(ownerKey);
  const filtered = list.filter((x) => x.id !== id);
  if (filtered.length === list.length) return false;
  await writePreCadastrosForOwner(ownerKey, filtered);
  return true;
}

export async function clearAllPreCadastrosTaf(): Promise<void> {
  try {
    const uid = getCachedDataOwnerUid();
    const keys = new Set(['local']);
    if (uid) keys.add(uid);
    await Promise.all([...keys].map((ownerKey) => removeAppMeta(preCadastroMetaKey(ownerKey))));
  } catch {
    // silencioso
  }
}
