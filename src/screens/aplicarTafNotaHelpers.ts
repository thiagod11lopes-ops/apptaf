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
import { limparResultadoModalidadeCadastro } from '../utils/limparResultadoModalidade';
import { formatNotaDesistenciaCorrida } from '../utils/notaReprovacaoTexto';

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
    /** Data do teste DD/MM/AAAA (padrão: hoje). */
    dataAplicacaoBr?: string;
  },
): CadastroItemPersist {
  const hoje = (opts.dataAplicacaoBr ?? '').trim() || dataHojeBr();
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
    const base = modoTafNaval ? cadastro : limparResultadoModalidadeCadastro(cadastro, 'caminhada');
    return {
      ...base,
      tempoCorrida: tempoStr,
      dataTafCorrida: hoje,
      notaCorrida: nota,
      ...(modoTafNaval ? {} : { modalidadeDistanciaAtiva: 'corrida' as const }),
    };
  }

  if (prova === 'caminhada') {
    const tempoStr = formatMsByModality('corrida', tempoMs);
    const nota = notaCaminhadaParaPersistencia(textoNotaCaminhada(tempoMs, idade, sexo));
    const base = limparResultadoModalidadeCadastro(cadastro, 'corrida');
    return {
      ...base,
      tempoCaminhada: tempoStr,
      dataTafCaminhada: hoje,
      notaCaminhada: nota,
      modalidadeDistanciaAtiva: 'caminhada',
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

/** Permanência: aprovado/reprovado com data (Registrador / Aplicar). */
export function aplicarPermanenciaNoCadastro(
  cadastro: CadastroItemPersist,
  resultado: 'aprovado' | 'reprovado',
  opts?: { dataAplicacaoBr?: string; tempoPermanencia?: string },
): CadastroItemPersist {
  const data = (opts?.dataAplicacaoBr ?? '').trim() || dataHojeBr();
  const tempo =
    (opts?.tempoPermanencia ?? '').trim() ||
    (cadastro.tempoPermanencia ?? '').trim() ||
    '10:00';
  return {
    ...cadastro,
    resultadoPermanencia: resultado,
    resultadoNatacao: undefined,
    tempoPermanencia: tempo,
    dataTafPermanencia: data,
  };
}

/** Desistência em corrida/natação: reprovado com data (teste aplicado). */
export function aplicarDesistenciaNoCadastro(
  cadastro: CadastroItemPersist,
  prova: 'corrida' | 'natacao',
  opts: {
    modoTafNaval: boolean;
    /** Corrida: voltas marcadas no abandono → nota REP. (n). */
    voltasCompletas?: number;
    /** Tempo do cronômetro no abandono (ms). */
    tempoMs?: number | null;
  },
): CadastroItemPersist {
  const hoje = dataHojeBr();
  if (prova === 'corrida') {
    const base = opts.modoTafNaval
      ? cadastro
      : limparResultadoModalidadeCadastro(cadastro, 'caminhada');
    const tempoStr =
      opts.tempoMs != null && Number.isFinite(opts.tempoMs) && opts.tempoMs >= 0
        ? formatMsByModality('corrida', opts.tempoMs)
        : undefined;
    return {
      ...base,
      tempoCorrida: tempoStr,
      dataTafCorrida: hoje,
      notaCorrida: formatNotaDesistenciaCorrida(opts.voltasCompletas ?? 0),
      ...(opts.modoTafNaval ? {} : { modalidadeDistanciaAtiva: 'corrida' as const }),
    };
  }
  return {
    ...cadastro,
    tempoNatacao:
      opts.tempoMs != null && Number.isFinite(opts.tempoMs) && opts.tempoMs >= 0
        ? formatMsByModality('natacao', opts.tempoMs)
        : undefined,
    dataTafNatacao: hoje,
    notaNatacao: 'REPROVADO',
  };
}

export type { NotaRepeticoesResult };
