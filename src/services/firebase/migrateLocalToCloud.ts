import { getAllCadastrosLocal } from '../cadastrosIndexedDb';
import { getAllSessoesAplicacaoLocal } from '../resultadosAplicadosIndexedDb';
import {
  addCadastrosEmLoteFirestore,
  getAllCadastrosFirestore,
} from './cadastrosFirestore';
import { addSessaoFirestore, getAllSessoesFirestore } from './sessoesFirestore';

export type LocalCloudMigrationResult = {
  cadastrosEnviados: number;
  sessoesEnviadas: number;
  cadastrosLocais: number;
  cadastrosNaNuvem: number;
};

export async function migrateLocalDataToCloud(uid: string): Promise<LocalCloudMigrationResult> {
  if (typeof indexedDB === 'undefined') {
    const cloudCadastros = await getAllCadastrosFirestore(uid);
    const cloudSessoes = await getAllSessoesFirestore(uid);
    return {
      cadastrosEnviados: 0,
      sessoesEnviadas: 0,
      cadastrosLocais: 0,
      cadastrosNaNuvem: cloudCadastros.length,
    };
  }

  const [localCadastros, localSessoes, cloudCadastros, cloudSessoes] = await Promise.all([
    getAllCadastrosLocal(),
    getAllSessoesAplicacaoLocal(),
    getAllCadastrosFirestore(uid),
    getAllSessoesFirestore(uid),
  ]);

  const cloudCadastroIds = new Set(cloudCadastros.map((c) => c.id));
  const cloudSessaoIds = new Set(cloudSessoes.map((s) => s.id));

  const cadastrosToUpload = localCadastros.filter((c) => !cloudCadastroIds.has(c.id));
  const sessoesToUpload = localSessoes.filter((s) => !cloudSessaoIds.has(s.id));

  if (cadastrosToUpload.length > 0) {
    await addCadastrosEmLoteFirestore(uid, cadastrosToUpload);
  }

  for (const sessao of sessoesToUpload) {
    await addSessaoFirestore(uid, sessao);
  }

  return {
    cadastrosEnviados: cadastrosToUpload.length,
    sessoesEnviadas: sessoesToUpload.length,
    cadastrosLocais: localCadastros.length,
    cadastrosNaNuvem: cloudCadastros.length + cadastrosToUpload.length,
  };
}
