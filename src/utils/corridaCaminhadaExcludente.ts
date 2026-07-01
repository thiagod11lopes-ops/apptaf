import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { TipoProvaTAF } from '../taf/tafProvaTypes';
import type { ResultadoTafLinha } from './resultadoTafCadastro';
import { temAvaliacaoCorrida, temAvaliacaoCaminhada } from './resultadoTafCadastro';

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

/** Modalidade oposta que ficará dispensável ao aplicar corrida ou caminhada (TAF Armada). */
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
    const dc = (item.dataTafCorrida || '').trim();
    const dm = (item.dataTafCaminhada || '').trim();
    if (dc && dm) return compareDataBr(dc, dm) >= 0 ? 'corrida' : 'caminhada';
    return 'corrida';
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
