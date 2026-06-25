import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedDataOwnerUid, waitForAuthenticatedUid } from './firebase/authUid';

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

const KEY_PREFIX = 'taf_pre_cadastros:';

async function storageKey(): Promise<string> {
  const uid = getCachedDataOwnerUid() ?? (await waitForAuthenticatedUid());
  return `${KEY_PREFIX}${uid ?? 'local'}`;
}

export async function getAllPreCadastrosTaf(): Promise<PreCadastroTaf[]> {
  const key = await storageKey();
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PreCadastroTaf[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPreCadastroTaf(item: PreCadastroTaf): Promise<void> {
  const list = await getAllPreCadastrosTaf();
  list.unshift(item);
  const key = await storageKey();
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export async function removePreCadastroTaf(id: string): Promise<boolean> {
  const key = await storageKey();
  const list = await getAllPreCadastrosTaf();
  const filtered = list.filter((x) => x.id !== id);
  if (filtered.length === list.length) return false;
  await AsyncStorage.setItem(key, JSON.stringify(filtered));
  return true;
}

export async function clearAllPreCadastrosTaf(): Promise<void> {
  try {
    const uid = getCachedDataOwnerUid();
    const keys = new Set([`${KEY_PREFIX}local`]);
    if (uid) keys.add(`${KEY_PREFIX}${uid}`);
    await Promise.all([...keys].map((key) => AsyncStorage.removeItem(key)));
  } catch {
    // silencioso
  }
}
