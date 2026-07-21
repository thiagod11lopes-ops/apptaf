import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

export type ModalidadeResultadoTaf = 'corrida' | 'natacao' | 'permanencia' | 'caminhada';

const LABEL_MODALIDADE: Record<ModalidadeResultadoTaf, string> = {
  corrida: 'Corrida',
  natacao: 'Natação',
  permanencia: 'Permanência',
  caminhada: 'Caminhada',
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
      next.rubricaCorridaSvg = undefined;
      if (next.modalidadeDistanciaAtiva === 'corrida') {
        next.modalidadeDistanciaAtiva = undefined;
      }
      break;
    case 'natacao':
      next.tempoNatacao = undefined;
      next.notaNatacao = undefined;
      next.resultadoNatacao = undefined;
      next.dataTafNatacao = undefined;
      next.rubricaNatacaoSvg = undefined;
      break;
    case 'permanencia':
      next.tempoPermanencia = undefined;
      next.resultadoPermanencia = undefined;
      next.dataTafPermanencia = undefined;
      next.rubricaPermanenciaSvg = undefined;
      if (
        next.resultadoNatacao === 'aprovado' ||
        next.resultadoNatacao === 'reprovado'
      ) {
        next.resultadoNatacao = undefined;
      }
      break;
    case 'caminhada':
      next.tempoCaminhada = undefined;
      next.notaCaminhada = undefined;
      next.dataTafCaminhada = undefined;
      next.rubricaCaminhadaSvg = undefined;
      if (next.modalidadeDistanciaAtiva === 'caminhada') {
        next.modalidadeDistanciaAtiva = undefined;
      }
      break;
  }

  return next;
}

/** Remove resultados de todas as modalidades (mantém dados pessoais do cadastro). */
export function limparTodosResultadosTafCadastro(c: CadastroItemPersist): CadastroItemPersist {
  let next = c;
  for (const modalidade of ['corrida', 'natacao', 'permanencia', 'caminhada'] as const) {
    next = limparResultadoModalidadeCadastro(next, modalidade);
  }
  return next;
}

/** true se o cadastro ainda tem algum campo de resultado de TAF. */
export function cadastroTemResultadoTaf(c: CadastroItemPersist): boolean {
  const legado = c as CadastroItemPersist & { tempo?: string };
  return Boolean(
    (legado.tempo ?? '').trim() ||
      (c.tempoCorrida ?? '').trim() ||
      (c.notaCorrida ?? '').trim() ||
      (c.dataTafCorrida ?? '').trim() ||
      (c.rubricaCorridaSvg ?? '').trim() ||
      (c.tempoNatacao ?? '').trim() ||
      (c.notaNatacao ?? '').trim() ||
      (c.resultadoNatacao ?? '').trim() ||
      (c.dataTafNatacao ?? '').trim() ||
      (c.rubricaNatacaoSvg ?? '').trim() ||
      (c.tempoPermanencia ?? '').trim() ||
      (c.resultadoPermanencia ?? '').trim() ||
      (c.dataTafPermanencia ?? '').trim() ||
      (c.rubricaPermanenciaSvg ?? '').trim() ||
      (c.tempoCaminhada ?? '').trim() ||
      (c.notaCaminhada ?? '').trim() ||
      (c.dataTafCaminhada ?? '').trim() ||
      (c.rubricaCaminhadaSvg ?? '').trim() ||
      c.modalidadeDistanciaAtiva === 'corrida' ||
      c.modalidadeDistanciaAtiva === 'caminhada',
  );
}
