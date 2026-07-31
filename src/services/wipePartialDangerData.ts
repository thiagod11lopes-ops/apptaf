/**
 * Exclusões parciais da zona de perigo (chefe):
 * - testes/sessões (mantém cadastros, fatores, aplicadores…)
 * - fatores de risco (mantém o restante)
 * - restritos / dispensas (mantém o restante)
 * - sessões do Modo Teste (demo-sess-*)
 * - datas de nascimento dos cadastros (mantém o restante do cadastro)
 */
import { isFirebaseConfigured } from '../config/firebase';
import { dataStore } from '../offline-first/store/DataStore';
import {
  listSessoes,
  softDeleteSessao,
  resolveOwnerUid,
} from '../offline-first/db/localDb';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { syncManager } from '../offline-first/sync/SyncManager';
import { invalidateRemoteSnapshotCache } from '../offline-first/sync/remoteSnapshotCache';
import { forceNextFullRemoteFetch } from '../offline-first/sync/syncWatermark';
import { getCachedLoginUid } from './firebase/authUid';
import { clearLocalSessoesAplicacao } from './resultadosAplicadosIndexedDb';
import { clearAllFatoresRisco } from './fatoresRiscoStorage';
import { clearAllRestritos } from './restritosStorage';
import {
  cadastroTemResultadoTaf,
  limparTodosResultadosTafCadastro,
} from '../utils/limparResultadoModalidade';
import { wipeOwnerTable } from './supabase/ownerDocs';
import { isDemoSessaoId } from '../utils/gatherSystemBackupData';

export type WipeAllTestesResult = {
  sessoesDeleted: number;
  cadastrosLimpos: number;
  cloudCleared: boolean;
};

export type WipeAllFatoresRiscoResult = {
  registrosRemovidos: number;
};

export type WipeAllRestritosResult = {
  registrosRemovidos: number;
  cloudCleared: boolean;
};

export type WipeAllModoTesteResult = {
  sessoesDeleted: number;
};

export type WipeAllDatasNascimentoResult = {
  cadastrosAtualizados: number;
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

/**
 * Exclui todos os restritos/dispensas.
 * Mantém cadastros, testes, fatores e aplicadores. Com wipeCloud, limpa a tabela na nuvem.
 */
export async function wipeAllRestritosData(options: {
  uid: string | null;
  wipeCloud: boolean;
}): Promise<WipeAllRestritosResult> {
  const canWipeCloud =
    options.wipeCloud && Boolean(options.uid?.trim()) && isFirebaseConfigured();

  if (canWipeCloud && options.uid) {
    await wipeOwnerTable('restritos', options.uid.trim());
    await forceNextFullRemoteFetch(options.uid.trim());
  }

  const registrosRemovidos = await clearAllRestritos(options.uid);
  notifyDataChanged();
  invalidateRemoteSnapshotCache();
  syncManager.scheduleOnlineWriteFlush();

  return { registrosRemovidos, cloudCleared: canWipeCloud };
}

/**
 * Apaga sessões aplicadas no Modo Teste (ids demo-sess-*).
 * Não altera testes reais, cadastros nem a nuvem (esses ids nunca sincronizam).
 */
export async function wipeAllModoTesteSessoes(options: {
  uid: string | null;
}): Promise<WipeAllModoTesteResult> {
  const ownerUid = resolveOwnerUid(options.uid);
  const sessoes = await listSessoes(ownerUid, true);
  const demoIds = sessoes.filter((s) => isDemoSessaoId(s.id)).map((s) => s.id);

  if (demoIds.length === 0) {
    return { sessoesDeleted: 0 };
  }

  const db = getTafDatabase();
  if (db) {
    await db.sessoes.bulkDelete(demoIds);
  } else {
    const userId = getCachedLoginUid();
    for (const id of demoIds) {
      await softDeleteSessao(id, ownerUid, userId);
    }
  }

  notifyDataChanged();
  return { sessoesDeleted: demoIds.length };
}

/**
 * Remove a data de nascimento de todos os cadastros (fica vazia).
 * Mantém nome, NIP, posto, resultados de TAF e demais campos.
 */
export async function wipeAllDatasNascimentoCadastros(options: {
  uid: string | null;
}): Promise<WipeAllDatasNascimentoResult> {
  const ownerUid = resolveOwnerUid(options.uid);
  const cadastros = await dataStore.getCadastros(ownerUid);
  const atualizados = cadastros
    .filter((c) => (c.dataNascimento || '').trim().length > 0)
    .map((c) => ({ ...c, dataNascimento: '' }));

  if (atualizados.length > 0) {
    await dataStore.upsertCadastrosBatch(atualizados, ownerUid);
  } else {
    notifyDataChanged();
  }

  invalidateRemoteSnapshotCache();
  syncManager.scheduleOnlineWriteFlush();

  return { cadastrosAtualizados: atualizados.length };
}
