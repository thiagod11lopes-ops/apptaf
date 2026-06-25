import { getAllCadastrosLocal, clearLocalCadastros } from './cadastrosIndexedDb';
import {
  getAllSessoesAplicacaoLocal,
  clearLocalSessoesAplicacao,
} from './resultadosAplicadosIndexedDb';
import { importLocalDeviceDataToCloud } from './offline/offlineCloudEngine';

export type LocalMigrationResult = {
  hadLocalData: boolean;
  cadastros: number;
  sessoes: number;
};

/**
 * Após login (chefe ou autorizado), envia cadastros/sessões criados offline
 * (sem Google) para o banco na nuvem e limpa o armazenamento local legado.
 */
export async function migrateLocalDeviceDataOnLogin(uid: string): Promise<LocalMigrationResult> {
  const [cadastros, sessoes] = await Promise.all([
    getAllCadastrosLocal(),
    getAllSessoesAplicacaoLocal(),
  ]);

  if (cadastros.length === 0 && sessoes.length === 0) {
    return { hadLocalData: false, cadastros: 0, sessoes: 0 };
  }

  await importLocalDeviceDataToCloud(uid, cadastros, sessoes);

  await Promise.all([clearLocalCadastros(), clearLocalSessoesAplicacao()]);

  return {
    hadLocalData: true,
    cadastros: cadastros.length,
    sessoes: sessoes.length,
  };
}
