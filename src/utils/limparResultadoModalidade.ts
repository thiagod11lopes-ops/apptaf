import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

export type ModalidadeResultadoTaf = 'corrida' | 'natacao' | 'permanencia';

const LABEL_MODALIDADE: Record<ModalidadeResultadoTaf, string> = {
  corrida: 'Corrida',
  natacao: 'Natação',
  permanencia: 'Permanência',
};

export function labelModalidadeResultado(m: ModalidadeResultadoTaf): string {
  return LABEL_MODALIDADE[m];
}

/** Remove todos os campos de resultado da modalidade no cadastro (mantém dados pessoais). */
export function limparResultadoModalidadeCadastro(
  c: CadastroItemPersist,
  modalidade: ModalidadeResultadoTaf,
): CadastroItemPersist {
  const next: CadastroItemPersist = { ...c };
  const legado = next as CadastroItemPersist & { tempo?: string };

  switch (modalidade) {
    case 'corrida':
      delete legado.tempo;
      next.tempoCorrida = undefined;
      next.notaCorrida = undefined;
      next.dataTafCorrida = undefined;
      break;
    case 'natacao':
      next.tempoNatacao = undefined;
      next.notaNatacao = undefined;
      next.resultadoNatacao = undefined;
      next.dataTafNatacao = undefined;
      break;
    case 'permanencia':
      next.tempoPermanencia = undefined;
      next.resultadoPermanencia = undefined;
      next.dataTafPermanencia = undefined;
      break;
  }

  return next;
}
