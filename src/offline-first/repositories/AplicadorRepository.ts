import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import { dataStore } from '../store/DataStore';
import { resolveStorageOwnerUid } from '../../services/firebase/authUid';

/** Repository — gravação exclusiva via Dexie (DataStore). */
export const aplicadorRepository = {
  async list(): Promise<AplicadorItemPersist[]> {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getAplicadores(uid);
  },

  async save(item: AplicadorItemPersist): Promise<void> {
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertAplicador(item, uid);
  },

  async remove(id: string): Promise<void> {
    const uid = await resolveStorageOwnerUid();
    await dataStore.deleteAplicador(id, uid);
  },
};
