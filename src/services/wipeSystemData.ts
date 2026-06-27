import { clearLocalCadastros } from './cadastrosIndexedDb';
import { clearLocalSessoesAplicacao } from './resultadosAplicadosIndexedDb';
import { clearLocalAplicadores } from './aplicadoresIndexedDb';
import { clearAllPreCadastrosTaf } from './preCadastroTafStorage';
import {
  clearMemoryCloudCache,
  resetCloudDataCache,
} from './cloudDataCache';
import { calcularResumoInicioTafFromHistorico } from '../utils/resultadoGeralHistorico';
import { isFirebaseConfigured } from '../config/firebase';
import { wipeOwnerData } from '../offline-first/db/localDb';
import { getTafDatabase, setMeta } from '../offline-first/db/tafDatabase';
import { resetCloudSyncStatus, setCloudSyncResult } from './offline/cloudSyncActivity';
import { syncEngine } from '../offline-first/sync/SyncEngine';
import { systemState } from '../offline-first/sync/SystemState';
import { clearPersistedStorageOwner } from './firebase/authUid';
import { setLocalTeamWipeAck } from './applyTeamWipeIfNeeded';
import type { WipeCloudTeamResult } from './firebase/wipeCloudDataFirestore';

export type WipeSystemDataOptions = {
  uid: string | null;
  /** Apaga nuvem do chefe e contas autorizadas (somente e-mail chefe). */
  wipeCloud: boolean;
};

export type WipeSystemDataResult = {
  localCleared: boolean;
  cloudCleared: boolean;
  cloudCounts?: WipeCloudTeamResult;
};

export async function wipeSystemData(options: WipeSystemDataOptions): Promise<WipeSystemDataResult> {
  await Promise.all([
    clearLocalCadastros(),
    clearLocalSessoesAplicacao(),
    clearLocalAplicadores(),
    clearAllPreCadastrosTaf(),
  ]);

  const resumo = calcularResumoInicioTafFromHistorico([], []);
  const uid = options.uid?.trim() || null;

  if (uid) {
    await resetCloudDataCache(uid, resumo);
    if (getTafDatabase()) {
      await wipeOwnerData(uid);
      await setMeta(`migrated:${uid}`, '0');
      await syncEngine.resetAfterWipe(uid);
    }
    clearPersistedStorageOwner();
    resetCloudSyncStatus();
    setCloudSyncResult(true);
  } else {
    clearMemoryCloudCache();
  }

  const canWipeCloud = options.wipeCloud && !!uid && isFirebaseConfigured();
  if (!canWipeCloud) {
    return { localCleared: true, cloudCleared: false };
  }

  await systemState.setOnlineMode();
  syncEngine.bindOwner(uid);
  const cloudCounts = await syncEngine.wipeCloudTeam(uid);
  await systemState.setOfflineMode();
  await setLocalTeamWipeAck(uid, cloudCounts.teamWipeAt);
  return {
    localCleared: true,
    cloudCleared: true,
    cloudCounts,
  };
}
