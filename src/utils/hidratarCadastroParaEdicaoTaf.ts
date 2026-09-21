import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

function firstNonEmpty(...vals: Array<string | null | undefined>): string | undefined {
  for (const v of vals) {
    const t = (v ?? '').trim();
    if (t && t !== '—') return t;
  }
  return undefined;
}

export type SementesEdicaoResultadoTaf = {
  tempoCorrida?: string;
  tempoNatacao?: string;
  tempoCaminhada?: string;
  tempoPermanencia?: string;
  notaCorrida?: string;
  notaNatacao?: string;
  notaCaminhada?: string;
  situacaoPermanencia?: string;
};

/**
 * Une cadastro + tempos/notas do Resultado Geral (histórico) para o modal de edição
 * nunca abrir vazio quando a tabela já mostra o resultado.
 */
export function hidratarCadastroParaEdicaoTaf(
  cadastro: CadastroItemPersist,
  seeds?: SementesEdicaoResultadoTaf | null,
): CadastroItemPersist {
  const legado = cadastro as CadastroItemPersist & { tempo?: string };
  const tempoCorrida = firstNonEmpty(
    cadastro.tempoCorrida,
    legado.tempo,
    seeds?.tempoCorrida,
  );
  const tempoNatacao = firstNonEmpty(cadastro.tempoNatacao, seeds?.tempoNatacao);
  const tempoCaminhada = firstNonEmpty(cadastro.tempoCaminhada, seeds?.tempoCaminhada);
  const tempoPermanencia = firstNonEmpty(cadastro.tempoPermanencia, seeds?.tempoPermanencia);
  const notaCorrida = firstNonEmpty(cadastro.notaCorrida, seeds?.notaCorrida);
  const notaNatacao = firstNonEmpty(cadastro.notaNatacao, seeds?.notaNatacao);
  const notaCaminhada = firstNonEmpty(cadastro.notaCaminhada, seeds?.notaCaminhada);

  let resultadoPermanencia = cadastro.resultadoPermanencia ?? cadastro.resultadoNatacao;
  if (resultadoPermanencia !== 'aprovado' && resultadoPermanencia !== 'reprovado') {
    const sit = (seeds?.situacaoPermanencia ?? '').trim().toLowerCase();
    if (sit === 'aprovado') resultadoPermanencia = 'aprovado';
    else if (sit === 'reprovado') resultadoPermanencia = 'reprovado';
  }

  return {
    ...cadastro,
    ...(tempoCorrida ? { tempoCorrida } : {}),
    ...(tempoNatacao ? { tempoNatacao } : {}),
    ...(tempoCaminhada ? { tempoCaminhada } : {}),
    ...(tempoPermanencia ? { tempoPermanencia } : {}),
    ...(notaCorrida ? { notaCorrida } : {}),
    ...(notaNatacao ? { notaNatacao } : {}),
    ...(notaCaminhada ? { notaCaminhada } : {}),
    ...(resultadoPermanencia === 'aprovado' || resultadoPermanencia === 'reprovado'
      ? { resultadoPermanencia }
      : {}),
  };
}

/** Extrai sementes de uma linha do Resultado Geral / Consulta. */
export function sementesEdicaoFromLinhaResultado(linha: {
  notaCorrida?: string;
  notaNatacao?: string;
  notaCaminhada?: string;
  situacaoPermanencia?: string;
  permanenciaTempo?: string;
  tempoCorrida?: string;
  tempoNatacao?: string;
  tempoCaminhada?: string;
}): SementesEdicaoResultadoTaf {
  return {
    tempoCorrida: linha.tempoCorrida,
    tempoNatacao: linha.tempoNatacao,
    tempoCaminhada: linha.tempoCaminhada,
    tempoPermanencia: linha.permanenciaTempo,
    notaCorrida: linha.notaCorrida,
    notaNatacao: linha.notaNatacao,
    notaCaminhada: linha.notaCaminhada,
    situacaoPermanencia: linha.situacaoPermanencia,
  };
}
