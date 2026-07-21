/**
 * Exclusões parciais da zona de perigo (chefe):
 * - testes/sessões (mantém cadastros, fatores, aplicadores…)
 * - fatores de risco (mantém o restante)
 */
import { isFirebaseConfigured } from '../config/firebase';
import { dataStore } from '../offline-first/store/DataStore';
import {
  listSessoes,
  softDeleteSessao,
  resolveOwnerUid,
} from '../offline-first/db/localDb';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { syncManager } from '../offline-first/sync/SyncManager';
import { invalidateRemoteSnapshotCache } from '../offline-first/sync/remoteSnapshotCache';
import { forceNextFullRemoteFetch } from '../offline-first/sync/syncWatermark';
import { getCachedLoginUid } from './firebase/authUid';
import { clearLocalSessoesAplicacao } from './resultadosAplicadosIndexedDb';
import { clearAllFatoresRisco } from './fatoresRiscoStorage';
import {
  cadastroTemResultadoTaf,
  limparTodosResultadosTafCadastro,
} from '../utils/limparResultadoModalidade';
import { wipeOwnerTable } from './supabase/ownerDocs';

export type WipeAllTestesResult = {
  sessoesDeleted: number;
  cadastrosLimpos: number;
  cloudCleared: boolean;
};

export type WipeAllFatoresRiscoResult = {
  registrosRemovidos: number;
};

async function wipeCloudTestesTables(ownerUid: string): Promise<void> {
  await wipeOwnerTable('sessoes', ownerUid);
  await wipeOwnerTable('sessao_rubricas', ownerUid);
}

/**
 * Exclui todos os testes (sessões/resultados de TAF).
 * Mantém cadastros (dados pessoais), fatores de risco, aplicadores e pré-cadastros.
 */
export async function wipeAllTestesData(options: {
  uid: string | null;
  wipeCloud: boolean;
}): Promise<WipeAllTestesResult> {
  const ownerUid = resolveOwnerUid(options.uid);
  const userId = getCachedLoginUid();
  const canWipeCloud =
    options.wipeCloud && Boolean(options.uid?.trim()) && isFirebaseConfigured();

  if (canWipeCloud && options.uid) {
    await wipeCloudTestesTables(options.uid.trim());
    await forceNextFullRemoteFetch(options.uid.trim());
  }

  const sessoes = await listSessoes(ownerUid, false);
  for (const sessao of sessoes) {
    await softDeleteSessao(sessao.id, ownerUid, userId);
  }
  await clearLocalSessoesAplicacao();

  const cadastros = await dataStore.getCadastros(ownerUid);
  const limpos = cadastros
    .filter(cadastroTemResultadoTaf)
    .map((c) => limparTodosResultadosTafCadastro(c));
  if (limpos.length > 0) {
    await dataStore.upsertCadastrosBatch(limpos, ownerUid);
  } else {
    notifyDataChanged();
  }

  invalidateRemoteSnapshotCache();
  syncManager.scheduleOnlineWriteFlush();

  return {
    sessoesDeleted: sessoes.length,
    cadastrosLimpos: limpos.length,
    cloudCleared: canWipeCloud,
  };
}

/** Exclui todos os fatores de risco; demais dados permanecem. */
export async function wipeAllFatoresRiscoData(): Promise<WipeAllFatoresRiscoResult> {
  const registrosRemovidos = await clearAllFatoresRisco();
  notifyDataChanged();
  return { registrosRemovidos };
}
