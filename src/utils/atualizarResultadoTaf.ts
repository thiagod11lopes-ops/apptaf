import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { addCadastro } from '../services/cadastrosIndexedDb';
import {
  addSessaoAplicacao,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import {
  notaCorridaParaPersistencia,
  textoNotaCorridaFromCadastro,
} from '../taf/corrida2400Nota';
import {
  notaNatacaoParaPersistencia,
  textoNotaNatacaoFromCadastro,
} from '../taf/natacaoNota';
import { removerParticipanteModalidadeDoHistorico } from './registroModalidadeHistorico';
import { persistirSessoesRegistradorFromCadastro } from './sessoesUnificadasResultados';
import { dataHojeBr } from './tafRegistro';
import {
  tempoMinutosSegundosValido,
} from './formatMinutosSegundos';

export type EdicaoResultadoTafInput = {
  tempoCorrida: string;
  tempoNatacao: string;
  permanencia: 'aprovado' | 'reprovado' | null;
};

export function validarEdicaoResultadoTaf(input: EdicaoResultadoTafInput): string | null {
  if (!tempoMinutosSegundosValido(input.tempoCorrida.trim())) {
    return 'Corrida: use o formato MM:SS (ex.: 12:45). Deixe vazio para remover.';
  }
  if (!tempoMinutosSegundosValido(input.tempoNatacao.trim())) {
    return 'Natação: use o formato MM:SS (ex.: 12:45). Deixe vazio para remover.';
  }
  const tc = input.tempoCorrida.trim();
  const tn = input.tempoNatacao.trim();
  if (!tc && !tn && !input.permanencia) {
    return 'Informe ao menos um resultado (corrida, natação ou permanência).';
  }
  return null;
}

export function aplicarEdicaoNoCadastro(
  base: CadastroItemPersist,
  input: EdicaoResultadoTafInput,
): CadastroItemPersist {
  const hoje = dataHojeBr();
  const tc = input.tempoCorrida.trim();
  const tn = input.tempoNatacao.trim();

  const next: CadastroItemPersist = {
    ...base,
    tempoCorrida: tc || undefined,
    tempoNatacao: tn || undefined,
    dataTafCorrida: tc ? hoje : undefined,
    dataTafNatacao: tn ? hoje : undefined,
    notaCorrida: tc
      ? notaCorridaParaPersistencia(
          textoNotaCorridaFromCadastro({
            tempoCorrida: tc,
            dataNascimento: base.dataNascimento,
            sexo: base.sexo,
          }),
        )
      : undefined,
    notaNatacao: tn
      ? notaNatacaoParaPersistencia(
          textoNotaNatacaoFromCadastro({
            tempoNatacao: tn,
            dataNascimento: base.dataNascimento,
            sexo: base.sexo,
          }),
        )
      : undefined,
    resultadoPermanencia: input.permanencia ?? undefined,
    dataTafPermanencia: input.permanencia ? hoje : undefined,
    resultadoNatacao: undefined,
  };

  if (!tc) {
    next.dataTafCorrida = undefined;
    next.rubricaCorridaSvg = undefined;
  }
  if (!tn) {
    next.dataTafNatacao = undefined;
    next.rubricaNatacaoSvg = undefined;
  }
  if (!input.permanencia) {
    next.dataTafPermanencia = undefined;
    next.tempoPermanencia = undefined;
    next.resultadoPermanencia = undefined;
    next.rubricaPermanenciaSvg = undefined;
  }

  return next;
}

/** Salva edição no cadastro e sincroniza o histórico de sessões. */
export async function salvarResultadosTafEditados(
  base: CadastroItemPersist,
  input: EdicaoResultadoTafInput,
): Promise<CadastroItemPersist> {
  const erro = validarEdicaoResultadoTaf(input);
  if (erro) throw new Error(erro);

  const atualizado = aplicarEdicaoNoCadastro(base, input);
  await addCadastro(atualizado);

  const tipos: TipoProvaAplicada[] = ['corrida', 'natacao', 'permanencia'];
  for (const tipo of tipos) {
    await removerParticipanteModalidadeDoHistorico(atualizado.nip, tipo);
  }
  await persistirSessoesRegistradorFromCadastro(atualizado, addSessaoAplicacao);

  return atualizado;
}
