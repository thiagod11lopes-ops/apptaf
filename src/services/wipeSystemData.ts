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
import { wipeOwnerData } from '../offline-first/db/localDb';
import { getTafDatabase, setMeta } from '../offline-first/db/tafDatabase';

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
    if (getTafDatabase()) {
      await wipeOwnerData(uid);
      await setMeta(`migrated:${uid}`, '0');
    }
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
