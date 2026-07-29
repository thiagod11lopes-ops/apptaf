import type { ResultadoCorridaItem } from '../navigation/types';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import type { NormaTafPreCadastro } from '../services/preCadastroTafStorage';
import {
  addSessaoAplicacao,
  deleteSessaoAplicacao,
  getAllSessoesAplicacao,
  updateSessaoAplicacao,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import { nipDigitos } from './nipFormat';
import { dataBrParaIso } from './tafRegistro';

const PREFIXO_REGISTRADOR = 'registrador-';

function normaSessao(s: SessaoAplicacaoTaf): NormaTafPreCadastro {
  return s.normaTaf ?? 'armada';
}

function mesmoGrupoTeste(
  s: SessaoAplicacaoTaf,
  dataAplicacao: string,
  tipoProva: TipoProvaAplicada,
  norma: NormaTafPreCadastro,
): boolean {
  return (
    s.dataAplicacao === dataAplicacao &&
    s.tipoProva === tipoProva &&
    normaSessao(s) === norma
  );
}

/**
 * Inclui (ou atualiza) um participante na sessão de grupo do mesmo teste
 * (data + tipo + norma), evitando um card por militar no Histórico.
 */
export async function upsertParticipanteSessaoGrupoHistorico(params: {
  dataAplicacao: string;
  tipoProva: TipoProvaAplicada;
  normaTaf: NormaTafPreCadastro;
  resultado: ResultadoCorridaItem;
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
}): Promise<string> {
  const { dataAplicacao, tipoProva, normaTaf, resultado, aplicadorAssinatura } = params;
  const sessoes = await getAllSessoesAplicacao({ includeDemo: true });
  const candidatas = sessoes.filter((s) =>
    mesmoGrupoTeste(s, dataAplicacao, tipoProva, normaTaf),
  );

  candidatas.sort((a, b) => {
    const score = (s: SessaoAplicacaoTaf) => {
      let n = s.resultados.length * 10;
      if (s.aplicadorAssinatura) n += 40;
      if (!s.id.startsWith(PREFIXO_REGISTRADOR)) n += 30;
      if (s.id.startsWith('grupo-') || s.id.startsWith('sessao-')) n += 20;
      return n;
    };
    return score(b) - score(a);
  });

  const alvo = candidatas[0];
  const nipKey = nipDigitos(resultado.nip ?? '');

  if (alvo) {
    const resultados = [...alvo.resultados];
    const idx = resultados.findIndex((r) => {
      const d = nipDigitos(r.nip ?? '');
      if (nipKey.length >= 8 && d === nipKey) return true;
      return (
        (r.nome ?? '').trim().toLowerCase() === (resultado.nome ?? '').trim().toLowerCase() &&
        (resultado.nome ?? '').trim().length >= 2
      );
    });
    if (idx >= 0) {
      resultados[idx] = { ...resultado, corredor: idx + 1 };
    } else {
      resultados.push({ ...resultado, corredor: resultados.length + 1 });
    }

    const atualizada: SessaoAplicacaoTaf = {
      ...alvo,
      resultados,
      aplicadorAssinatura: aplicadorAssinatura ?? alvo.aplicadorAssinatura,
      normaTaf,
      updatedAt: Date.now(),
    };
    await updateSessaoAplicacao(atualizada);

    // Remove sessões 1-a-1 antigas do mesmo militar/teste, se existirem.
    for (const s of candidatas.slice(1)) {
      if (s.resultados.length !== 1) continue;
      const soEste =
        nipKey.length >= 8 && nipDigitos(s.resultados[0]?.nip ?? '') === nipKey;
      if (!soEste) continue;
      try {
        await deleteSessaoAplicacao(s.id);
      } catch {
        // Melhor esforço — o Histórico ainda agrupa na exibição.
      }
    }

    return alvo.id;
  }

  const iso = dataBrParaIso(dataAplicacao) ?? dataAplicacao.replace(/\D/g, '');
  const id = `grupo-${iso}-${tipoProva}-${normaTaf}-${Date.now()}`;
  return addSessaoAplicacao({
    id,
    dataAplicacao,
    tipoProva,
    resultados: [{ ...resultado, corredor: 1 }],
    aplicadorAssinatura,
    normaTaf,
  });
}
