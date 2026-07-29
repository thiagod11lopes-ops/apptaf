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
import { isDemoCadastroId, isDemoSessaoId } from './gatherSystemBackupData';
import { getNipsRestritosAtivos } from '../services/restritosStorage';
import {
  getNipsComFatorRiscoSim,
  getNipsComFatoresRiscoPreenchidos,
} from '../services/fatoresRiscoStorage';

const RESUMO_VAZIO: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
  restritos: 0,
  fatoresRisco: 0,
  cadastroIncompleto: 0,
  reprovados: 0,
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
 * Modo Teste (ids demo-cad- e demo-sess-) não entra no balanço.
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
      .filter((row) => row.deleted !== true && !isDemoCadastroId(row.id))
      .map((row) => stripCadastro(row as unknown as Record<string, unknown>));

    const sessoes = sessRows
      .filter((row) => row.deleted !== true && !isDemoSessaoId(row.id))
      .map((row) => stripSessao(row as unknown as Record<string, unknown>));

    const sessoesExcluidas = allSessoes
      .filter((row) => row.deleted === true && !isDemoSessaoId(row.id))
      .map((row) => stripSessao(row as unknown as Record<string, unknown>));

    const [nipsRestritos, nipsFatores, nipsFatoresPreenchidos] = await Promise.all([
      getNipsRestritosAtivos(),
      getNipsComFatorRiscoSim(),
      getNipsComFatoresRiscoPreenchidos(),
    ]);

    return calcularResumoInicioTafFromHistorico(
      sessoes,
      cadastros,
      sessoesExcluidas,
      nipsRestritos,
      nipsFatores,
      nipsFatoresPreenchidos,
    );
  } catch (error) {
    console.warn('[home-resumo] leitura IndexedDB falhou:', error);
    return RESUMO_VAZIO;
  }
}
