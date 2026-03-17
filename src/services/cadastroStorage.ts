import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CadastroItem } from '../types/cadastro';

const KEY = '@taf_cadastros';

export async function getCadastros(): Promise<CadastroItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CadastroItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addCadastro(item: Omit<CadastroItem, 'id' | 'createdAt'>): Promise<CadastroItem> {
  const list = await getCadastros();
  const newItem: CadastroItem = {
    ...item,
    id: `cad_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  };
  list.push(newItem);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return newItem;
}

export async function updateCadastro(id: string, data: Partial<Omit<CadastroItem, 'id' | 'createdAt'>>): Promise<void> {
  const list = await getCadastros();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...data };
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function deleteCadastro(id: string): Promise<void> {
  if (!id) return;
  const list = await getCadastros();
  const novaLista = list.filter((c) => c.id !== id);
  if (novaLista.length === list.length) return; // id não encontrado, não sobrescrever
  await AsyncStorage.setItem(KEY, JSON.stringify(novaLista));
}
