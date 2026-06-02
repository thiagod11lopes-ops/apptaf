import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  deleteSessaoAplicacao,
  getAllSessoesAplicacao,
  tituloTipoProva,
  updateSessaoAplicacao,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import type { ResultadoCorridaItem } from '../navigation/types';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from './exportResultadosTafPdf';
import { nipDigitos } from './nipFormat';
import {
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';

export type RegistroModalidadeExistente = {
  origem: 'historico' | 'cadastro';
  dataAplicacao: string;
  tempo: string;
  nota: string;
  situacao: string;
  modalidadeLabel: string;
};

function situacaoFromResultado(r: ResultadoCorridaItem): string {
  if (r.reprovacaoTexto?.trim()) return r.reprovacaoTexto.trim();
  const nota = (r.notaTexto ?? r.noraTexto ?? '').trim();
  if (nota.toUpperCase() === 'REPROVADO') return 'Reprovado';
  if (nota.toLowerCase() === 'aprovado') return 'Aprovado';
  if (nota) return 'Aprovado';
  return '—';
}

function tempoFromResultado(tipo: TipoProvaAplicada, r: ResultadoCorridaItem): string {
  if (tipo === 'permanencia') return PERMANENCIA_TEMPO_PDF_PADRAO;
  const mod = tipo === 'natacao' ? 'natacao' : 'corrida';
  return formatMsByModality(mod, r.tempoMs) || '—';
}

function notaFromResultado(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function registroFromHistorico(
  sessao: SessaoAplicacaoTaf,
  r: ResultadoCorridaItem,
): RegistroModalidadeExistente {
  const tipo = sessao.tipoProva;
  return {
    origem: 'historico',
    dataAplicacao: sessao.dataAplicacao,
    tempo: tempoFromResultado(tipo, r),
    nota: notaFromResultado(r),
    situacao: situacaoFromResultado(r),
    modalidadeLabel: tituloTipoProva(tipo),
  };
}

function registroFromCadastro(c: CadastroItemPersist, tipo: TipoProvaAplicada): RegistroModalidadeExistente {
  if (tipo === 'corrida') {
    const nota = (c.notaCorrida ?? '').trim() || '—';
    return {
      origem: 'cadastro',
      dataAplicacao: (c.dataTafCorrida ?? '').trim() || '—',
      tempo: (c.tempoCorrida ?? '').trim() || '—',
      nota,
      situacao: nota.toUpperCase() === 'REPROVADO' ? 'Reprovado' : nota !== '—' ? 'Aprovado' : '—',
      modalidadeLabel: tituloTipoProva(tipo),
    };
  }
  if (tipo === 'natacao') {
    const nota = (c.notaNatacao ?? '').trim() || '—';
    return {
      origem: 'cadastro',
      dataAplicacao: (c.dataTafNatacao ?? '').trim() || '—',
      tempo: (c.tempoNatacao ?? '').trim() || '—',
      nota,
      situacao: nota.toUpperCase() === 'REPROVADO' ? 'Reprovado' : nota !== '—' ? 'Aprovado' : '—',
      modalidadeLabel: tituloTipoProva(tipo),
    };
  }
  const aprovado = c.resultadoPermanencia === 'aprovado';
  const reprovado = c.resultadoPermanencia === 'reprovado';
  return {
    origem: 'cadastro',
    dataAplicacao: (c.dataTafPermanencia ?? '').trim() || '—',
    tempo: (c.tempoPermanencia ?? '').trim() || PERMANENCIA_TEMPO_PDF_PADRAO,
    nota: aprovado ? 'Aprovado' : reprovado ? 'REPROVADO' : '—',
    situacao: aprovado ? 'Aprovado' : reprovado ? 'Reprovado' : '—',
    modalidadeLabel: tituloTipoProva(tipo),
  };
}

function temRegistroCadastro(c: CadastroItemPersist, tipo: TipoProvaAplicada): boolean {
  if (tipo === 'corrida') return temAvaliacaoCorrida(c);
  if (tipo === 'natacao') return temAvaliacaoNatacao(c);
  return temAvaliacaoPermanencia(c);
}

/** Busca o registro mais recente da modalidade no histórico; fallback no cadastro. */
export function buscarRegistroModalidadeExistente(
  nip: string,
  tipo: TipoProvaAplicada,
  sessoes: SessaoAplicacaoTaf[],
  cadastro: CadastroItemPersist,
): RegistroModalidadeExistente | null {
  const alvo = nipDigitos(nip);
  if (!alvo) return null;

  const doTipo = sessoes
    .filter((s) => s.tipoProva === tipo)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  for (const sessao of doTipo) {
    for (const r of sessao.resultados) {
      if (nipDigitos(r.nip) === alvo) {
        return registroFromHistorico(sessao, r);
      }
    }
  }

  if (temRegistroCadastro(cadastro, tipo)) {
    return registroFromCadastro(cadastro, tipo);
  }

  return null;
}

/** Remove o participante de todas as sessões da modalidade no histórico. */
export async function removerParticipanteModalidadeDoHistorico(
  nip: string,
  tipo: TipoProvaAplicada,
): Promise<void> {
  const alvo = nipDigitos(nip);
  if (!alvo) return;

  const sessoes = await getAllSessoesAplicacao();
  for (const sessao of sessoes) {
    if (sessao.tipoProva !== tipo) continue;
    const filtrados = sessao.resultados.filter((r) => nipDigitos(r.nip) !== alvo);
    if (filtrados.length === sessao.resultados.length) continue;
    if (filtrados.length === 0) {
      await deleteSessaoAplicacao(sessao.id);
    } else {
      await updateSessaoAplicacao({ ...sessao, resultados: filtrados });
    }
  }
}
