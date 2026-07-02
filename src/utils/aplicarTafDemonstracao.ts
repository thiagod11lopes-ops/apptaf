import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { DEMO_TOTAL_CFN } from './gerarDadosDemonstracaoTaf';

export function isCadastroDemonstracaoCfn(c: CadastroItemPersist): boolean {
  const match = /^demo-cad-(\d+)$/.exec(c.id);
  if (!match) return false;
  return Number(match[1]) < DEMO_TOTAL_CFN;
}

/** Militares fictícios compatíveis com TAF Armada ou CFN (modo demonstração). */
export function filtrarCadastrosDemonstracao(
  cadastros: CadastroItemPersist[],
  modoTafNaval: boolean,
): CadastroItemPersist[] {
  const demo = cadastros.filter((c) => c.id.startsWith('demo-cad-'));
  const pool =
    demo.length > 0
      ? demo.filter((c) => (modoTafNaval ? isCadastroDemonstracaoCfn(c) : !isCadastroDemonstracaoCfn(c)))
      : cadastros;
  return [...pool].sort((a, b) => a.nip.localeCompare(b.nip, 'pt-BR'));
}

export type NipFeedbackOk = {
  tipo: 'ok';
  texto: string;
  nomeMilitar: string;
  dataNascimento: string;
  sexo?: 'M' | 'F';
};

export function nipFeedbackOkFromCadastro(c: CadastroItemPersist): NipFeedbackOk {
  return {
    tipo: 'ok',
    texto: 'Militar Cadastrado no Sistema.',
    nomeMilitar: (c.nome || '').trim() || 'Sem nome',
    dataNascimento: c.dataNascimento || '',
    sexo: c.sexo,
  };
}
