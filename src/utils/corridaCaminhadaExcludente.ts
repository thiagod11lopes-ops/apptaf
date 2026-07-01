import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { TipoProvaTAF } from '../taf/tafProvaTypes';
import { buscarRegistroModalidadeNoHistorico, removerParticipanteModalidadeDoHistorico } from './registroModalidadeHistorico';
import type { ResultadoTafLinha } from './resultadoTafCadastro';
import {
  cadastroParaLinhaResultado,
  temAvaliacaoCorrida,
  temAvaliacaoCaminhada,
} from './resultadoTafCadastro';

export type ModalidadeExcludenteSubstituta = 'corrida' | 'caminhada';

function modalidadeConcluida(nota: string, situacao: string): boolean {
  const n = (nota || '').trim();
  if (n && n !== '—') return true;
  return situacao === 'Aprovado' || situacao === 'Reprovado';
}

function compareDataBr(a: string, b: string): number {
  const pa = a.trim().split('/').reverse().join('');
  const pb = b.trim().split('/').reverse().join('');
  return pa.localeCompare(pb);
}

function temRegistroModalidade(
  modalidade: ModalidadeExcludenteSubstituta,
  cadastro: CadastroItemPersist,
  nip: string,
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
): boolean {
  const noCadastro =
    modalidade === 'corrida' ? temAvaliacaoCorrida(cadastro) : temAvaliacaoCaminhada(cadastro);
  if (noCadastro) return true;
  return !!buscarRegistroModalidadeNoHistorico(nip, modalidade, cadastro, cadastros, sessoes);
}

/**
 * Detecta conflito corrida × caminhada ao confirmar NIP no TAF Armada.
 * Considera cadastro e Histórico; não avisa ao repetir a modalidade já vigente.
 */
export function detectarConflitoCorridaCaminhada(
  prova: TipoProvaTAF | null,
  cadastro: CadastroItemPersist,
  nip: string,
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  modoTafNaval: boolean,
): ModalidadeExcludenteSubstituta | null {
  if (modoTafNaval || (prova !== 'corrida' && prova !== 'caminhada')) return null;

  const oposta: ModalidadeExcludenteSubstituta = prova === 'corrida' ? 'caminhada' : 'corrida';
  const temOposta = temRegistroModalidade(oposta, cadastro, nip, sessoes, cadastros);
  if (!temOposta) return null;

  const temAtual = temRegistroModalidade(prova, cadastro, nip, sessoes, cadastros);
  if (temAtual) {
    const linha = cadastroParaLinhaResultado(cadastro);
    const vigente = modalidadeCorridaCaminhadaVigente(linha);
    if (vigente === prova) return null;
    if (vigente === oposta) return oposta;
  }

  return oposta;
}

/** @deprecated Use {@link detectarConflitoCorridaCaminhada} com sessões do Histórico. */
export function avisoModalidadeExcludente(
  prova: TipoProvaTAF | null,
  cadastro: CadastroItemPersist,
  modoTafNaval: boolean,
): ModalidadeExcludenteSubstituta | null {
  if (modoTafNaval || !prova) return null;
  if (prova === 'corrida' && temAvaliacaoCaminhada(cadastro)) return 'caminhada';
  if (prova === 'caminhada' && temAvaliacaoCorrida(cadastro)) return 'corrida';
  return null;
}

export function labelModalidadeExcludente(modalidade: ModalidadeExcludenteSubstituta): string {
  return modalidade === 'corrida' ? 'Corrida 2.400 m' : 'Caminhada 4.800 m';
}

type LinhaCorridaCaminhada = Pick<
  ResultadoTafLinha,
  | 'notaCorrida'
  | 'situacaoCorrida'
  | 'notaCaminhada'
  | 'situacaoCaminhada'
  | 'dataTafCorrida'
  | 'dataTafCaminhada'
  | 'modalidadeDistanciaAtiva'
  | 'corridaRegistradaEm'
  | 'caminhadaRegistradaEm'
>;

/** Qual modalidade corrida/caminhada prevalece na linha de resultados. */
export function modalidadeCorridaCaminhadaVigente(
  item: LinhaCorridaCaminhada,
): 'corrida' | 'caminhada' | null {
  const temCorrida = modalidadeConcluida(item.notaCorrida, item.situacaoCorrida);
  const temCaminhada = modalidadeConcluida(item.notaCaminhada, item.situacaoCaminhada);
  if (temCorrida && !temCaminhada) return 'corrida';
  if (temCaminhada && !temCorrida) return 'caminhada';
  if (temCorrida && temCaminhada) {
    if (item.modalidadeDistanciaAtiva === 'corrida' || item.modalidadeDistanciaAtiva === 'caminhada') {
      return item.modalidadeDistanciaAtiva;
    }

    const ic = (item.corridaRegistradaEm || '').trim();
    const im = (item.caminhadaRegistradaEm || '').trim();
    if (ic && im && ic !== im) {
      return ic.localeCompare(im) > 0 ? 'corrida' : 'caminhada';
    }

    const dc = (item.dataTafCorrida || '').trim();
    const dm = (item.dataTafCaminhada || '').trim();
    if (dc && dm) {
      const cmp = compareDataBr(dc, dm);
      if (cmp !== 0) return cmp > 0 ? 'corrida' : 'caminhada';
    }

    if (ic && im) return ic.localeCompare(im) >= 0 ? 'corrida' : 'caminhada';
  }
  return null;
}

export function modalidadeCorridaCaminhadaDispensavel(
  item: LinhaCorridaCaminhada,
  alvo: 'corrida' | 'caminhada',
): boolean {
  const vigente = modalidadeCorridaCaminhadaVigente(item);
  if (!vigente) return false;
  return vigente !== alvo;
}

/** Modalidade oposta a corrida/caminhada no TAF Armada. */
export function modalidadeDistanciaOposta(
  prova: 'corrida' | 'caminhada',
): ModalidadeExcludenteSubstituta {
  return prova === 'corrida' ? 'caminhada' : 'corrida';
}

export async function removerModalidadeOpostaDistanciaDoHistorico(
  nip: string,
  prova: 'corrida' | 'caminhada',
  cadastro: CadastroItemPersist,
): Promise<void> {
  await removerParticipanteModalidadeDoHistorico(nip, modalidadeDistanciaOposta(prova), cadastro);
}
