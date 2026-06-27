import { getAllCadastrosLocal, clearLocalCadastros } from './cadastrosIndexedDb';
import {
  getAllSessoesAplicacaoLocal,
  clearLocalSessoesAplicacao,
} from './resultadosAplicadosIndexedDb';
import { saveCadastro, saveSessao } from '../offline-first/db/localDb';
import { getCachedLoginUid } from './firebase/authUid';

export type LocalMigrationResult = {
  hadLocalData: boolean;
  cadastros: number;
  sessoes: number;
};

/**
 * Após login, importa cadastros/sessões do IndexedDB legado para Dexie (offline-first).
 * Sincronização com a nuvem ocorre apenas via Assistente de Sincronização.
 */
export async function migrateLocalDeviceDataOnLogin(uid: string): Promise<LocalMigrationResult> {
  const [cadastros, sessoes] = await Promise.all([
    getAllCadastrosLocal(),
    getAllSessoesAplicacaoLocal(),
  ]);

  if (cadastros.length === 0 && sessoes.length === 0) {
    return { hadLocalData: false, cadastros: 0, sessoes: 0 };
  }

  const userId = getCachedLoginUid();
  for (const cad of cadastros) {
    await saveCadastro(cad, uid, userId);
  }
  for (const sess of sessoes) {
    await saveSessao(sess, uid, userId);
  }

  await Promise.all([clearLocalCadastros(), clearLocalSessoesAplicacao()]);

  return {
    hadLocalData: true,
    cadastros: cadastros.length,
    sessoes: sessoes.length,
  };
}
