import { clearLocalCadastros } from './cadastrosIndexedDb';
import { clearLocalSessoesAplicacao } from './resultadosAplicadosIndexedDb';
import { clearAllPreCadastrosTaf } from './preCadastroTafStorage';
import {
  clearMemoryCloudCache,
  resetCloudDataCache,
} from './cloudDataCache';
import { wipeCloudUserDataFirestore, type WipeCloudCounts } from './firebase/wipeCloudDataFirestore';
import { calcularResumoInicioTafFromHistorico } from '../utils/resultadoGeralHistorico';
import { isFirebaseConfigured } from '../config/firebase';

export type WipeSystemDataOptions = {
  uid: string | null;
  /** Apaga também cadastros e resultados no Firebase (somente chefe da conta). */
  wipeCloud: boolean;
};

export type WipeSystemDataResult = {
  localCleared: boolean;
  cloudCleared: boolean;
  cloudCounts?: WipeCloudCounts;
};

export async function wipeSystemData(options: WipeSystemDataOptions): Promise<WipeSystemDataResult> {
  await Promise.all([
    clearLocalCadastros(),
    clearLocalSessoesAplicacao(),
    clearAllPreCadastrosTaf(),
  ]);

  const resumo = calcularResumoInicioTafFromHistorico([], []);
  const uid = options.uid?.trim() || null;

  if (uid) {
    await resetCloudDataCache(uid, resumo);
  } else {
    clearMemoryCloudCache();
  }

  const canWipeCloud = options.wipeCloud && !!uid && isFirebaseConfigured();
  if (!canWipeCloud) {
    return { localCleared: true, cloudCleared: false };
  }

  const cloudCounts = await wipeCloudUserDataFirestore(uid);
  return {
    localCleared: true,
    cloudCleared: true,
    cloudCounts,
  };
}
