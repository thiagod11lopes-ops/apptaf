import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import {
  listCadastrosForDisplay,
  listSessoesForDisplay,
} from '../offline-first/db/localDb';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from './resultadoGeralHistorico';

const RESUMO_VAZIO: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
};

function stripCadastro(row: Record<string, unknown>): CadastroItemPersist {
  const copy = { ...row };
  for (const key of [
    'ownerUid',
    'createdAt',
    'version',
    'deviceId',
    'userId',
    'syncStatus',
    'deleted',
    'deletedAt',
    'deletedBy',
    'lastModifiedBy',
    'syncVersion',
  ]) {
    delete copy[key];
  }
  return copy as unknown as CadastroItemPersist;
}

function stripSessao(row: Record<string, unknown>): SessaoAplicacaoTaf {
  const copy = { ...row };
  for (const key of [
    'ownerUid',
    'createdAt',
    'version',
    'deviceId',
    'userId',
    'syncStatus',
    'deleted',
    'deletedAt',
    'deletedBy',
    'lastModifiedBy',
    'syncVersion',
  ]) {
    delete copy[key];
  }
  return copy as unknown as SessaoAplicacaoTaf;
}

/**
 * Resumo dos cards da Home **somente a partir do IndexedDB (Dexie)**.
 * Não consulta a nuvem — evita zerar Cadastrados/Parcial/Concluídos/Pendente
 * quando a sync falha ou a nuvem está vazia/divergente.
 */
export async function loadResumoInicioFromIndexedDb(): Promise<ResumoInicioTafHistorico> {
  const db = getTafDatabase();
  if (!db) return RESUMO_VAZIO;

  try {
    const [cadRows, sessRows, allSessoes] = await Promise.all([
      listCadastrosForDisplay(null),
      listSessoesForDisplay(null),
      db.sessoes.toArray(),
    ]);

    const cadastros = cadRows
      .filter((row) => row.deleted !== true)
      .map((row) => stripCadastro(row as unknown as Record<string, unknown>));

    const sessoes = sessRows
      .filter((row) => row.deleted !== true)
      .map((row) => stripSessao(row as unknown as Record<string, unknown>));

    const sessoesExcluidas = allSessoes
      .filter((row) => row.deleted === true)
      .map((row) => stripSessao(row as unknown as Record<string, unknown>));

    return calcularResumoInicioTafFromHistorico(sessoes, cadastros, sessoesExcluidas);
  } catch (error) {
    console.warn('[home-resumo] leitura IndexedDB falhou:', error);
    return RESUMO_VAZIO;
  }
}
