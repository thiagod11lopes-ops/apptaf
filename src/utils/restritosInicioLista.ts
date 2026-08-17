import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  isDispensaAtiva,
  type RestritoRegistro,
} from '../services/restritosStorage';
import { compareNomePtBr } from './compareNomePtBr';
import { formatNipInput, nipChaveCadastro } from './nipFormat';
import { postoGradFromCadastro } from './resultadoTafCadastro';
import { dataHojeBr } from './tafRegistro';

export type RestritoInicioTafItem = {
  nip: string;
  nipKey: string;
  nome: string;
  postoGrad: string;
  dataInicio: string;
  dataFim: string;
  ativa: boolean;
};

function cadastroPorNip(
  cadastros: CadastroItemPersist[],
  nipKey: string,
): CadastroItemPersist | undefined {
  return cadastros.find((c) => nipChaveCadastro(c.nip) === nipKey);
}

/** Lista dos militares cadastrados como restrito (dispensa vigente ou agendada). */
export function montarListaRestritosInicio(
  registros: RestritoRegistro[],
  cadastros: CadastroItemPersist[] = [],
  refBr: string = dataHojeBr(),
): RestritoInicioTafItem[] {
  const itens: RestritoInicioTafItem[] = [];
  for (const reg of registros) {
    if (reg.deleted === true) continue;
    const nipKey = nipChaveCadastro(reg.nip);
    if (!nipKey) continue;
    const cadastro = cadastroPorNip(cadastros, nipKey);
    itens.push({
      nipKey,
      nip: formatNipInput(nipKey),
      nome: (reg.nome || cadastro?.nome || '').trim() || '—',
      postoGrad: cadastro ? postoGradFromCadastro(cadastro) : '—',
      dataInicio: (reg.dataInicio || '').trim() || '—',
      dataFim: (reg.dataFim || '').trim() || '—',
      ativa: isDispensaAtiva(reg, refBr),
    });
  }
  itens.sort((a, b) => compareNomePtBr(a.nome, b.nome) || a.nipKey.localeCompare(b.nipKey));
  return itens;
}

export function textoSituacaoRestrito(item: Pick<RestritoInicioTafItem, 'ativa'>): string {
  return item.ativa ? 'Ativa' : 'Agendada';
}
