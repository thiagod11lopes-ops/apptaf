import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { postoGradExibicaoAssinatura } from '../types/aplicadorAssinatura';
import { listarResultadosGeralFromHistorico } from './resultadoGeralHistorico';
import {
  enriquecerLinhasComRubricas,
  type ResultadoTafLinha,
} from './resultadoTafCadastro';
import type { RubricasPorNip } from './rubricasDasSessoes';
import { compareNomePtBr } from './compareNomePtBr';

const SEM_APLICADOR_KEY = '__sem_aplicador__';

export type ResultadosTafPdfBloco = {
  linhas: ResultadoTafLinha[];
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
  /** Título do bloco (ex.: "Aplicador: CT Fulano" ou "Sem aplicador"). */
  rotuloAplicador: string;
};

function chaveAplicador(assinatura: AplicadorAssinaturaResumo | undefined): string {
  if (!assinatura?.nome?.trim()) return SEM_APLICADOR_KEY;
  return (
    assinatura.aplicadorId?.trim() ||
    `${(assinatura.nip ?? '').trim()}:${assinatura.nome.trim().toLowerCase()}`
  );
}

function rotuloDeAssinatura(assinatura: AplicadorAssinaturaResumo | undefined): string {
  if (!assinatura?.nome?.trim()) return 'Sem aplicador';
  const posto = postoGradExibicaoAssinatura(assinatura).trim();
  return posto ? `Aplicador: ${posto} ${assinatura.nome.trim()}` : `Aplicador: ${assinatura.nome.trim()}`;
}

type GrupoSessoesAplicador = {
  key: string;
  sessoes: SessaoAplicacaoTaf[];
  assinatura?: AplicadorAssinaturaResumo;
};

/** Agrupa sessões pelo aplicador (sem aplicador → grupo próprio). */
export function agruparSessoesPorAplicador(
  sessoes: SessaoAplicacaoTaf[],
): GrupoSessoesAplicador[] {
  const byKey = new Map<string, GrupoSessoesAplicador>();

  for (const sessao of sessoes) {
    const assinatura = sessao.aplicadorAssinatura;
    const key = chaveAplicador(assinatura);
    const atual = byKey.get(key);
    if (!atual) {
      byKey.set(key, {
        key,
        sessoes: [sessao],
        assinatura: assinatura?.nome?.trim() ? assinatura : undefined,
      });
      continue;
    }
    atual.sessoes.push(sessao);
    if (!atual.assinatura?.rubricaSvg?.trim() && assinatura?.rubricaSvg?.trim()) {
      atual.assinatura = assinatura;
    } else if (!atual.assinatura && assinatura?.nome?.trim()) {
      atual.assinatura = assinatura;
    }
  }

  const grupos = Array.from(byKey.values());
  grupos.sort((a, b) => {
    if (a.key === SEM_APLICADOR_KEY) return 1;
    if (b.key === SEM_APLICADOR_KEY) return -1;
    const na = a.assinatura?.nome ?? '';
    const nb = b.assinatura?.nome ?? '';
    return compareNomePtBr(na, nb);
  });
  return grupos;
}

/**
 * Monta um bloco de tabela PDF por aplicador (rúbrica própria; sem rúbrica → campo em branco).
 */
export function montarBlocosResultadosTafPorAplicador(opts: {
  sessoes: SessaoAplicacaoTaf[];
  cadastros: CadastroItemPersist[];
  rubricasSessoes?: RubricasPorNip;
  somenteSessoesInformadas?: boolean;
}): ResultadosTafPdfBloco[] {
  const grupos = agruparSessoesPorAplicador(opts.sessoes);
  const blocos: ResultadosTafPdfBloco[] = [];

  for (const g of grupos) {
    const linhasBase = listarResultadosGeralFromHistorico(g.sessoes, opts.cadastros, {
      somenteSessoesInformadas: opts.somenteSessoesInformadas ?? true,
    });
    if (linhasBase.length === 0) continue;
    const linhas = enriquecerLinhasComRubricas(
      linhasBase,
      opts.cadastros,
      opts.rubricasSessoes,
    );
    blocos.push({
      linhas,
      aplicadorAssinatura: g.assinatura,
      rotuloAplicador: rotuloDeAssinatura(g.assinatura),
    });
  }

  return blocos;
}
