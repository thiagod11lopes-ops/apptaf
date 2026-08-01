import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'taf:generoManualCadastroIds';

async function lerIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string' && x.trim() !== ''));
  } catch {
    return new Set();
  }
}

async function gravarIds(ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
}

/** Marca cadastro cujo gênero foi definido manualmente (não sobrescrever na auto-correção). */
export async function marcarGeneroManualCadastro(id: string): Promise<void> {
  const ids = await lerIds();
  ids.add(id);
  await gravarIds(ids);
}

export async function isGeneroManualCadastro(id: string): Promise<boolean> {
  const ids = await lerIds();
  return ids.has(id);
}

export async function getGeneroManualCadastroIds(): Promise<Set<string>> {
  return lerIds();
}
