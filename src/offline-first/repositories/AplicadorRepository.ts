import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import { dataStore } from '../store/DataStore';
import { resolveStorageOwnerUid } from '../../services/firebase/authUid';
import { isAuthorizedMemberSession } from '../../utils/aplicadorSyncPolicy';

/** Repository — gravação exclusiva via Dexie (DataStore). */
export const aplicadorRepository = {
  async list(): Promise<AplicadorItemPersist[]> {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getAplicadores(uid);
  },

  async save(item: AplicadorItemPersist): Promise<void> {
    if (isAuthorizedMemberSession()) {
      throw new Error('Cadastro de aplicador disponível apenas para o e-mail chefe.');
    }
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertAplicador(item, uid);
  },

  async remove(id: string): Promise<void> {
    if (isAuthorizedMemberSession()) {
      throw new Error('Cadastro de aplicador disponível apenas para o e-mail chefe.');
    }
    const uid = await resolveStorageOwnerUid();
    await dataStore.deleteAplicador(id, uid);
  },
};
