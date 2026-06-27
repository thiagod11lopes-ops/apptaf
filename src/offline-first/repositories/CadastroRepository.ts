import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import { dataStore } from '../store/DataStore';
import { resolveStorageOwnerUid } from '../../services/firebase/authUid';

export const cadastroRepository = {
  async list(): Promise<CadastroItemPersist[]> {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getCadastros(uid);
  },

  async getById(id: string): Promise<CadastroItemPersist | null> {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getCadastroById(id, uid);
  },

  async save(item: CadastroItemPersist): Promise<void> {
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertCadastro(item, uid);
  },

  async saveBatch(items: CadastroItemPersist[]): Promise<void> {
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertCadastrosBatch(items, uid);
  },

  async remove(id: string): Promise<void> {
    const uid = await resolveStorageOwnerUid();
    await dataStore.deleteCadastro(id, uid);
  },
};
