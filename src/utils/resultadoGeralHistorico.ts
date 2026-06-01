import type { ResultadoCorridaItem } from '../navigation/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from './exportResultadosTafPdf';
import { formatNipInput, nipDigitos } from './nipFormat';
import type { ResultadoGeralItem } from './resultadoTafCadastro';

type ModalidadeHistorico = {
  nota: string;
  situacao: string;
  tempo?: string;
  rubricaSvg?: string;
};

type AggRow = {
  id: string;
  nip: string;
  nome: string;
  corrida?: ModalidadeHistorico;
  natacao?: ModalidadeHistorico;
  permanencia?: ModalidadeHistorico;
};

function chaveParticipanteAnon(nip: string, nome: string): string {
  const d = nipDigitos(nip);
  if (d.length >= 8) return `nip:${d}`;
  const n = nome.trim().toLowerCase();
  if (n.length >= 2) return `nome:${n}`;
  return '';
}

function idParticipante(
  r: ResultadoCorridaItem,
  cadastros: CadastroItemPersist[],
): string {
  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  if (busca.kind === 'found') return busca.cadastro.id;
  return chaveParticipanteAnon(r.nip ?? '', r.nome ?? '');
}

function situacaoFromResultado(r: ResultadoCorridaItem): string {
  const rep = (r.reprovacaoTexto ?? '').trim();
  if (rep) return rep;
  const nota = (r.notaTexto ?? r.noraTexto ?? '').trim();
  if (nota.toUpperCase() === 'REPROVADO') return 'Reprovado';
  if (nota) return 'Aprovado';
  return '—';
}

function notaFromResultado(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function tempoPermanenciaFromResultado(r: ResultadoCorridaItem): string {
  if (r.tempoMs > 0 && r.tempoMs < 10 * 60 * 1000) {
    return formatMsByModality('corrida', r.tempoMs) || PERMANENCIA_TEMPO_PDF_PADRAO;
  }
  return PERMANENCIA_TEMPO_PDF_PADRAO;
}

function sliceFromResultado(
  tipo: TipoProvaAplicada,
  r: ResultadoCorridaItem,
): ModalidadeHistorico {
  if (tipo === 'permanencia') {
    return {
      nota: '—',
      situacao: situacaoFromResultado(r),
      tempo: tempoPermanenciaFromResultado(r),
      rubricaSvg: r.rubricaCandidatoSvg,
    };
  }
  return {
    nota: notaFromResultado(r),
    situacao: situacaoFromResultado(r),
    rubricaSvg: r.rubricaCandidatoSvg,
  };
}

function atualizarIdentidade(agg: AggRow, r: ResultadoCorridaItem, cadastros: CadastroItemPersist[]) {
  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  if (busca.kind === 'found') {
    agg.nip = formatNipInput(busca.cadastro.nip ?? '') || agg.nip;
    agg.nome = (busca.cadastro.nome ?? '').trim() || agg.nome;
    return;
  }
  const nipFmt = formatNipInput(r.nip ?? '');
  if (nipFmt.trim()) agg.nip = nipFmt;
  const nome = (r.nome ?? '').trim();
  if (nome) agg.nome = nome;
}

function aggParaLinha(agg: AggRow): ResultadoGeralItem {
  const temCorrida = !!agg.corrida;
  const temNatacao = !!agg.natacao;
  const temPerm = !!agg.permanencia;

  return {
    id: agg.id,
    nip: agg.nip || '—',
    nome: agg.nome || '—',
    notaCorrida: temCorrida ? agg.corrida!.nota : '—',
    situacaoCorrida: temCorrida ? agg.corrida!.situacao : '—',
    notaNatacao: temNatacao ? agg.natacao!.nota : '—',
    situacaoNatacao: temNatacao ? agg.natacao!.situacao : '—',
    permanenciaTempo: temPerm ? (agg.permanencia!.tempo ?? '—') : '—',
    situacaoPermanencia: temPerm ? agg.permanencia!.situacao : '—',
    rubricaCorridaSvg: agg.corrida?.rubricaSvg,
    rubricaNatacaoSvg: agg.natacao?.rubricaSvg,
    rubricaPermanenciaSvg: agg.permanencia?.rubricaSvg,
    statusTaf:
      temCorrida && temNatacao && temPerm ? ('Completo' as const) : ('Parcial' as const),
  };
}

/**
 * Monta o Resultado Geral exclusivamente a partir das sessões do Histórico.
 * Modalidades ausentes no histórico aparecem como "—" na tabela.
 */
export function listarResultadosGeralFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): ResultadoGeralItem[] {
  const map = new Map<string, AggRow>();
  const ordenadas = [...sessoes].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  for (const sessao of ordenadas) {
    const tipo = sessao.tipoProva;
    for (const r of sessao.resultados) {
      const id = idParticipante(r, cadastros);
      if (!id) continue;

      let agg = map.get(id);
      if (!agg) {
        const busca = buscarCadastroPorNomeOuNip(
          cadastros,
          (r.nip ?? '').trim() || (r.nome ?? '').trim(),
        );
        agg = {
          id: busca.kind === 'found' ? busca.cadastro.id : id,
          nip:
            busca.kind === 'found'
              ? formatNipInput(busca.cadastro.nip ?? '') || '—'
              : formatNipInput(r.nip ?? '') || '—',
          nome:
            busca.kind === 'found'
              ? (busca.cadastro.nome ?? '').trim() || '—'
              : (r.nome ?? '').trim() || '—',
        };
        map.set(id, agg);
      }

      atualizarIdentidade(agg, r, cadastros);
      const slice = sliceFromResultado(tipo, r);

      if (tipo === 'corrida') agg.corrida = slice;
      else if (tipo === 'natacao') agg.natacao = slice;
      else if (tipo === 'permanencia') agg.permanencia = slice;
    }
  }

  return [...map.values()]
    .filter((agg) => agg.corrida || agg.natacao || agg.permanencia)
    .map(aggParaLinha)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
