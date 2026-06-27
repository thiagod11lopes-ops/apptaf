import type { CadastroItemPersist } from './cadastrosIndexedDb';
import { getAllCadastros } from './cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from './resultadosAplicadosIndexedDb';
import { deleteSessaoAplicacao } from './resultadosAplicadosIndexedDb';
import { resolveStorageOwnerUid } from './firebase/authUid';
import { dataStore } from '../offline-first/store/DataStore';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { limparResultadoModalidadeCadastro } from '../utils/limparResultadoModalidade';
import {
  isSessaoVirtualRegistrador,
  SESSAO_REGISTRADOR_ID_PREFIX,
} from '../utils/sessoesUnificadasResultados';

const REGISTRADOR_SESSAO_ID =
  /^registrador-(.+)-(corrida|natacao|permanencia)$/;

async function clearCadastroModalidade(
  cadastro: CadastroItemPersist,
  tipo: SessaoAplicacaoTaf['tipoProva'],
  ownerUid: string,
): Promise<void> {
  const limpo = limparResultadoModalidadeCadastro(cadastro, tipo);
  await dataStore.upsertCadastro(limpo, ownerUid);
}

/** Limpa campos do Registrador no cadastro para evitar sessões virtuais após exclusão. */
async function clearCadastrosForSessaoHistorico(sessao: SessaoAplicacaoTaf): Promise<void> {
  const ownerUid = await resolveStorageOwnerUid();
  const cadastros = await getAllCadastros();
  const tipo = sessao.tipoProva;

  const registradorMatch = sessao.id.match(REGISTRADOR_SESSAO_ID);
  if (registradorMatch) {
    const cadastroId = registradorMatch[1];
    const cad = cadastros.find((c) => c.id === cadastroId);
    if (cad) {
      await clearCadastroModalidade(cad, tipo, ownerUid);
    }
    return;
  }

  for (const resultado of sessao.resultados) {
    const alvo = (resultado.nip ?? '').trim() || (resultado.nome ?? '').trim();
    if (!alvo) continue;
    const busca = buscarCadastroPorNomeOuNip(cadastros, alvo);
    if (busca.kind === 'found') {
      await clearCadastroModalidade(busca.cadastro, tipo, ownerUid);
    }
  }
}

async function sessaoExistsInDb(id: string): Promise<boolean> {
  const db = getTafDatabase();
  if (!db) return false;
  const row = await db.sessoes.get(id);
  return row != null;
}

/**
 * Exclui sessão do histórico e remove dados do Registrador no cadastro quando aplicável,
 * para que histórico/resultado parcial não reapareçam em outros dispositivos.
 */
export async function deleteSessaoFromHistorico(sessao: SessaoAplicacaoTaf): Promise<void> {
  if (!sessao.id.trim()) {
    throw new Error('ID da sessão inválido.');
  }

  await clearCadastrosForSessaoHistorico(sessao);

  const isVirtual = isSessaoVirtualRegistrador(sessao);
  const persistedRegistrador = sessao.id.startsWith(SESSAO_REGISTRADOR_ID_PREFIX);
  const exists = await sessaoExistsInDb(sessao.id);

  if (isVirtual && !exists && !persistedRegistrador) {
    return;
  }

  await deleteSessaoAplicacao(sessao.id);
}
