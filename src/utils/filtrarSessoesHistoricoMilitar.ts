import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { nipDigitos } from './nipFormat';

export type FiltroHistoricoMilitar = {
  id: string;
  nip: string;
  nome: string;
};

function participanteCorrespondeMilitar(
  nipParticipante: string,
  nomeParticipante: string,
  filtro: FiltroHistoricoMilitar,
  cadastros: CadastroItemPersist[],
): boolean {
  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    nipParticipante.trim() || nomeParticipante.trim(),
  );
  if (busca.kind === 'found' && busca.cadastro.id === filtro.id) return true;

  const nipF = nipDigitos(filtro.nip);
  const nipP = nipDigitos(nipParticipante);
  if (nipF.length >= 8 && nipP.length >= 8 && nipF === nipP) return true;

  const nomeF = filtro.nome.trim().toLowerCase();
  const nomeP = nomeParticipante.trim().toLowerCase();
  if (nomeF.length >= 2 && nomeP === nomeF) return true;

  return false;
}

/** Sessões do histórico em que o militar participou (ao menos um resultado). */
export function filtrarSessoesHistoricoMilitar(
  sessoes: SessaoAplicacaoTaf[],
  filtro: FiltroHistoricoMilitar,
  cadastros: CadastroItemPersist[] = [],
): SessaoAplicacaoTaf[] {
  return sessoes.filter((sessao) =>
    (sessao.resultados ?? []).some((r) =>
      participanteCorrespondeMilitar(r.nip ?? '', r.nome ?? '', filtro, cadastros),
    ),
  );
}
