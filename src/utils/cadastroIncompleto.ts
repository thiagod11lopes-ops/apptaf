import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  FATORES_RISCO_ITENS,
  type FatoresRiscoRegistro,
} from '../services/fatoresRiscoStorage';
import { nipChaveCadastro } from './nipFormat';
import { dataNascimentoCadastroValida } from './cadastroDadosTaf';

/** Fatores salvos com Sim/Não em todos os itens (não basta o registro existir). */
export function fatoresRiscoRegistroPreenchido(
  reg: FatoresRiscoRegistro | null | undefined,
): boolean {
  if (!reg || reg.deleted === true) return false;
  return FATORES_RISCO_ITENS.every((item) => {
    const v = reg.respostas?.[item.id];
    return v === 'sim' || v === 'nao';
  });
}

/**
 * Cadastro incompleto: falta data de nascimento válida e/ou fatores de risco
 * preenchidos (ou só um dos dois preenchido).
 */
export function cadastroIncompletoNascimentoOuFatores(
  c: Pick<CadastroItemPersist, 'dataNascimento' | 'nip'>,
  nipsFatoresPreenchidos: Set<string> | ReadonlySet<string>,
): boolean {
  const nascOk = dataNascimentoCadastroValida(c.dataNascimento);
  const nipC = nipChaveCadastro(c.nip);
  const fatoresOk = !!nipC && nipsFatoresPreenchidos.has(nipC);
  return !nascOk || !fatoresOk;
}

export function contarCadastrosIncompletosNascimentoOuFatores(
  cadastros: ReadonlyArray<Pick<CadastroItemPersist, 'dataNascimento' | 'nip'>>,
  nipsFatoresPreenchidos: Set<string> | ReadonlySet<string>,
): number {
  let n = 0;
  for (const c of cadastros) {
    if (cadastroIncompletoNascimentoOuFatores(c, nipsFatoresPreenchidos)) n += 1;
  }
  return n;
}
