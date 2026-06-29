import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { textoNotaAbdominalPrancha, notaAbdominalPranchaParaPersistencia } from '../taf/abdominalPranchaNota';
import { textoNotaCorrida3200, notaCorrida3200ParaPersistencia } from '../taf/corrida3200Nota';
import {
  textoNotaPorRepeticoes,
  notaRepeticoesParaPersistencia,
  type NotaRepeticoesResult,
} from '../taf/fnRepeticoesNota';
import { textoNotaNatacao100, notaNatacao100ParaPersistencia } from '../taf/natacao100Nota';
import { textoNotaCorrida, notaCorridaParaPersistencia } from '../taf/corrida2400Nota';
import { textoNotaNatacao, notaNatacaoParaPersistencia } from '../taf/natacaoNota';
import { textoNotaCaminhada, notaCaminhadaParaPersistencia } from '../taf/caminhada4800Nota';
import { formatMsByModality } from '../taf/tafTimeFormat';
import type { TipoProvaTAF } from '../taf/tafProvaTypes';
import { dataHojeBr } from '../utils/tafRegistro';

type NipOk = {
  dataNascimento: string;
  sexo?: 'M' | 'F';
};

export function calcularNotaLinhaTempo(
  prova: TipoProvaTAF,
  tempoMs: number,
  fb: NipOk,
  modoTafNaval: boolean,
): string {
  const idade = idadeFromDataNascimento(fb.dataNascimento);
  if (prova === 'corrida') {
    return modoTafNaval
      ? textoNotaCorrida3200(tempoMs, idade, fb.sexo)
      : textoNotaCorrida(tempoMs, idade, fb.sexo);
  }
  if (prova === 'natacao') {
    return modoTafNaval
      ? textoNotaNatacao100(tempoMs, idade, fb.sexo)
      : textoNotaNatacao(tempoMs, idade, fb.sexo);
  }
  if (prova === 'caminhada') {
    return textoNotaCaminhada(tempoMs, idade, fb.sexo);
  }
  if (prova === 'abdominal_prancha') {
    return textoNotaAbdominalPrancha(tempoMs, idade, fb.sexo);
  }
  return '—';
}

export function calcularNotaLinhaReps(
  prova: 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
  repeticoes: number,
  fb: NipOk,
): string {
  const idade = idadeFromDataNascimento(fb.dataNascimento);
  return textoNotaPorRepeticoes(prova, repeticoes, idade, fb.sexo);
}

export function aplicarResultadoNoCadastro(
  cadastro: CadastroItemPersist,
  prova: TipoProvaTAF,
  opts: {
    tempoMs?: number;
    repeticoes?: number;
    modoTafNaval: boolean;
  },
): CadastroItemPersist {
  const hoje = dataHojeBr();
  const { tempoMs = 0, repeticoes, modoTafNaval } = opts;
  const idade = idadeFromDataNascimento(cadastro.dataNascimento);
  const sexo = cadastro.sexo;

  if (prova === 'natacao') {
    const tempoStr = formatMsByModality('natacao', tempoMs);
    const nota = modoTafNaval
      ? notaNatacao100ParaPersistencia(textoNotaNatacao100(tempoMs, idade, sexo))
      : notaNatacaoParaPersistencia(textoNotaNatacao(tempoMs, idade, sexo));
    return { ...cadastro, tempoNatacao: tempoStr, dataTafNatacao: hoje, notaNatacao: nota };
  }

  if (prova === 'corrida') {
    const tempoStr = formatMsByModality('corrida', tempoMs);
    const nota = modoTafNaval
      ? notaCorrida3200ParaPersistencia(textoNotaCorrida3200(tempoMs, idade, sexo))
      : notaCorridaParaPersistencia(textoNotaCorrida(tempoMs, idade, sexo));
    return { ...cadastro, tempoCorrida: tempoStr, dataTafCorrida: hoje, notaCorrida: nota };
  }

  if (prova === 'caminhada') {
    const tempoStr = formatMsByModality('corrida', tempoMs);
    const nota = notaCaminhadaParaPersistencia(textoNotaCaminhada(tempoMs, idade, sexo));
    return {
      ...cadastro,
      tempoCaminhada: tempoStr,
      dataTafCaminhada: hoje,
      notaCaminhada: nota,
    };
  }

  if (prova === 'abdominal_prancha') {
    const tempoStr = formatMsByModality('natacao', tempoMs);
    const nota = notaAbdominalPranchaParaPersistencia(textoNotaAbdominalPrancha(tempoMs, idade, sexo));
    return {
      ...cadastro,
      tempoAbdominalPrancha: tempoStr,
      dataTafAbdominalPrancha: hoje,
      notaAbdominalPrancha: nota,
    };
  }

  if (prova === 'flexao_barra' && repeticoes != null) {
    const nota = notaRepeticoesParaPersistencia(
      textoNotaPorRepeticoes('flexao_barra', repeticoes, idade, sexo),
    );
    return {
      ...cadastro,
      repsFlexaoBarra: repeticoes,
      dataTafFlexaoBarra: hoje,
      notaFlexaoBarra: nota,
    };
  }

  if (prova === 'flexao_solo' && repeticoes != null) {
    const nota = notaRepeticoesParaPersistencia(
      textoNotaPorRepeticoes('flexao_solo', repeticoes, idade, sexo),
    );
    return {
      ...cadastro,
      repsFlexaoSolo: repeticoes,
      dataTafFlexaoSolo: hoje,
      notaFlexaoSolo: nota,
    };
  }

  if (prova === 'abdominal_remador' && repeticoes != null) {
    const nota = notaRepeticoesParaPersistencia(
      textoNotaPorRepeticoes('abdominal_remador', repeticoes, idade, sexo),
    );
    return {
      ...cadastro,
      repsAbdominalRemador: repeticoes,
      dataTafAbdominalRemador: hoje,
      notaAbdominalRemador: nota,
    };
  }

  return cadastro;
}

export type { NotaRepeticoesResult };
