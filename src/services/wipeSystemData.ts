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
import { wipeOwnerData, ANONYMOUS_OWNER } from '../offline-first/db/localDb';
import { getTafDatabase, setMeta } from '../offline-first/db/tafDatabase';
import { preCadastroMetaKey, removeAppMeta } from '../offline-first/db/appMeta';
import { resetCloudSyncStatus, setCloudSyncResult } from './offline/cloudSyncActivity';
import { syncEngine } from '../offline-first/sync/SyncEngine';
import { syncManager } from '../offline-first/sync/SyncManager';
import { systemState } from '../offline-first/sync/SystemState';
import { invalidateRemoteSnapshotCache } from '../offline-first/sync/remoteSnapshotCache';
import { forceNextFullRemoteFetch } from '../offline-first/sync/syncWatermark';
import { clearPersistedStorageOwner } from './firebase/authUid';
import { setLocalTeamWipeAck } from './applyTeamWipeIfNeeded';
import type { WipeCloudTeamResult } from './firebase/wipeCloudDataFirestore';

export type WipeSystemDataOptions = {
  uid: string | null;
  /** Apaga nuvem do chefe e contas autorizadas (somente e-mail chefe). */
  wipeCloud: boolean;
  onProgress?: (update: WipeProgressUpdate) => void;
};

export type WipeSystemDataResult = {
  localCleared: boolean;
  cloudCleared: boolean;
  cloudCounts?: WipeCloudTeamResult;
};

export type WipeProgressPhase =
  | 'preparing'
  | 'cloud_connecting'
  | 'cloud_wiping'
  | 'local_cadastros'
  | 'local_sessoes'
  | 'local_aplicadores'
  | 'local_precadastros'
  | 'local_database'
  | 'finalizing'
  | 'done';

export type WipeProgressUpdate = {
  phase: WipeProgressPhase;
  label: string;
  percent: number;
  elapsedMs: number;
  cloudConnected: boolean;
  cloudEnabled: boolean;
  detail?: string;
};

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function reportProgress(
  onProgress: WipeSystemDataOptions['onProgress'],
  startTime: number,
  step: number,
  totalSteps: number,
  update: Omit<WipeProgressUpdate, 'percent' | 'elapsedMs'>,
): void {
  const percent = totalSteps <= 0 ? 0 : Math.min(99, Math.round((step / totalSteps) * 100));
  onProgress?.({
    ...update,
    percent,
    elapsedMs: Date.now() - startTime,
  });
}

export async function wipeSystemData(options: WipeSystemDataOptions): Promise<WipeSystemDataResult> {
  const startTime = Date.now();
  const uid = options.uid?.trim() || null;
  const canWipeCloud = options.wipeCloud && !!uid && isFirebaseConfigured();
  const onProgress = options.onProgress;

  const totalSteps =
    1 + // preparing
    (canWipeCloud ? 8 : 0) + // connect + 6 collections + team marker
    4 + // local legacy stores
    (uid ? 2 : 0) + // taf db wipe
    1; // finalizing

  let step = 0;

  await syncManager.beginSystemWipe();

  try {
    step += 1;
    reportProgress(onProgress, startTime, step, totalSteps, {
      phase: 'preparing',
      label: 'Preparando exclusão total…',
      cloudConnected: false,
      cloudEnabled: canWipeCloud,
    });
    await yieldToUi();

    let cloudCounts: WipeCloudTeamResult | undefined;

    if (canWipeCloud && uid) {
      step += 1;
      reportProgress(onProgress, startTime, step, totalSteps, {
        phase: 'cloud_connecting',
        label: 'Conectando à nuvem…',
        cloudConnected: false,
        cloudEnabled: true,
      });
      await systemState.setOnlineMode();
      syncEngine.bindOwner(uid);
      await yieldToUi();

      step += 1;
      reportProgress(onProgress, startTime, step, totalSteps, {
        phase: 'cloud_wiping',
        label: 'Excluindo dados na nuvem…',
        cloudConnected: true,
        cloudEnabled: true,
      });

      cloudCounts = await syncEngine.wipeCloudTeam(uid, (cloudUpdate) => {
        const cloudSubPercent =
          cloudUpdate.totalInCollection > 0
            ? cloudUpdate.deletedInCollection / cloudUpdate.totalInCollection
            : 1;
        const collectionWeight = 6 / totalSteps;
        const basePercent = step / totalSteps;
        const subPercent = (cloudSubPercent * collectionWeight) / 6;
        const percent = Math.min(99, Math.round((basePercent + subPercent) * 100));
        onProgress?.({
          phase: 'cloud_wiping',
          label: cloudUpdate.collectionLabel,
          percent,
          elapsedMs: Date.now() - startTime,
          cloudConnected: true,
          cloudEnabled: true,
          detail:
            cloudUpdate.totalInCollection > 0
              ? `${cloudUpdate.deletedInCollection.toLocaleString('pt-BR')} / ${cloudUpdate.totalInCollection.toLocaleString('pt-BR')} registros`
              : 'Nenhum registro encontrado',
        });
      });

      step += 6;
      reportProgress(onProgress, startTime, step, totalSteps, {
        phase: 'cloud_wiping',
        label: 'Marcando equipe para esvaziamento…',
        cloudConnected: true,
        cloudEnabled: true,
      });

      step += 1;
      await setLocalTeamWipeAck(uid, cloudCounts.teamWipeAt);
      await forceNextFullRemoteFetch(uid);
      await systemState.setOfflineMode();
      await yieldToUi();
    }

    step += 1;
    reportProgress(onProgress, startTime, step, totalSteps, {
      phase: 'local_cadastros',
      label: 'Excluindo cadastros locais…',
      cloudConnected: canWipeCloud,
      cloudEnabled: canWipeCloud,
    });
    await clearLocalCadastros();
    await yieldToUi();

    step += 1;
    reportProgress(onProgress, startTime, step, totalSteps, {
      phase: 'local_sessoes',
      label: 'Excluindo sessões e resultados locais…',
      cloudConnected: canWipeCloud,
      cloudEnabled: canWipeCloud,
    });
    await clearLocalSessoesAplicacao();
    await yieldToUi();

    step += 1;
    reportProgress(onProgress, startTime, step, totalSteps, {
      phase: 'local_aplicadores',
      label: 'Excluindo aplicadores locais…',
      cloudConnected: canWipeCloud,
      cloudEnabled: canWipeCloud,
    });
    await clearLocalAplicadores();
    await yieldToUi();

    step += 1;
    reportProgress(onProgress, startTime, step, totalSteps, {
      phase: 'local_precadastros',
      label: 'Excluindo pré-cadastros locais…',
      cloudConnected: canWipeCloud,
      cloudEnabled: canWipeCloud,
    });
    await clearAllPreCadastrosTaf();
    await yieldToUi();

    const resumo = calcularResumoInicioTafFromHistorico([], []);

    if (uid) {
      step += 1;
      reportProgress(onProgress, startTime, step, totalSteps, {
        phase: 'local_database',
        label: 'Limpando banco local e fila de sync…',
        cloudConnected: canWipeCloud,
        cloudEnabled: canWipeCloud,
      });
      await resetCloudDataCache(uid, resumo);
      invalidateRemoteSnapshotCache();
      if (getTafDatabase()) {
        await wipeOwnerData(uid);
        await wipeOwnerData(ANONYMOUS_OWNER);
        await setMeta(`migrated:${uid}`, '0');
      }
      await Promise.all([
        removeAppMeta(preCadastroMetaKey(uid)),
        removeAppMeta(preCadastroMetaKey('local')),
      ]);
      clearPersistedStorageOwner();
      resetCloudSyncStatus();
      setCloudSyncResult(true);
      await yieldToUi();

      step += 1;
      reportProgress(onProgress, startTime, step, totalSteps, {
        phase: 'local_database',
        label: 'Finalizando limpeza local…',
        cloudConnected: canWipeCloud,
        cloudEnabled: canWipeCloud,
      });
      if (getTafDatabase()) {
        await syncEngine.resetAfterWipe(uid);
      }
      await yieldToUi();
    } else {
      clearMemoryCloudCache();
    }

    step += 1;
    reportProgress(onProgress, startTime, step, totalSteps, {
      phase: 'finalizing',
      label: 'Concluindo exclusão…',
      cloudConnected: canWipeCloud,
      cloudEnabled: canWipeCloud,
    });

    if (uid) {
      await syncManager.endSystemWipe(uid);
    }

    onProgress?.({
      phase: 'done',
      label: 'Exclusão concluída',
      percent: 100,
      elapsedMs: Date.now() - startTime,
      cloudConnected: canWipeCloud,
      cloudEnabled: canWipeCloud,
    });

    if (canWipeCloud && cloudCounts) {
      return {
        localCleared: true,
        cloudCleared: true,
        cloudCounts,
      };
    }

    return { localCleared: true, cloudCleared: false };
  } catch (error) {
    await systemState.setOfflineMode().catch(() => undefined);
    syncManager.resumeAfterInterruptedWipe();
    throw error;
  }
}
