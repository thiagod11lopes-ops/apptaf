import type { ResultadoCorridaItem } from '../navigation/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { tempoStringParaMsProva } from './calcularIdade';
import {
  buildCadastroLookupIndex,
  buscarCadastroIndexed,
  type CadastroLookupIndex,
} from './cadastroLookupIndex';
import { nipDigitos } from './nipFormat';
import { dataBrParaIso, dataHojeBr } from './tafRegistro';
import {
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
  temAvaliacaoCaminhada,
} from './resultadoTafCadastro';
import { upsertParticipanteSessaoGrupoHistorico } from './upsertParticipanteSessaoGrupoHistorico';

export const SESSAO_REGISTRADOR_ID_PREFIX = 'registrador-';

/** Sessão persistida do Registrador / cadastro manual: registrador-{cadastroId}-{tipo}. */
export const REGISTRADOR_SESSAO_PERSISTIDA_RE =
  /^registrador-(.+)-(corrida|natacao|permanencia|caminhada|flexao_barra|flexao_solo|abdominal_remador|abdominal_prancha)$/;

export function isSessaoVirtualRegistrador(sessao: SessaoAplicacaoTaf): boolean {
  return sessao.id.startsWith(SESSAO_REGISTRADOR_ID_PREFIX);
}

/** Sessão do Registrador gravada no IndexedDB (pode ser excluída pelo histórico). */
export function isSessaoPersistidaRegistrador(sessao: SessaoAplicacaoTaf): boolean {
  return REGISTRADOR_SESSAO_PERSISTIDA_RE.test(sessao.id);
}

/** Sessão gerada só na memória (cadastro legado), sem registro no banco. */
export function isSessaoApenasVirtualCadastro(sessao: SessaoAplicacaoTaf): boolean {
  return isSessaoVirtualRegistrador(sessao) && !isSessaoPersistidaRegistrador(sessao);
}

function idParticipanteSessao(
  r: ResultadoCorridaItem,
  cadastros: CadastroItemPersist[],
  index: CadastroLookupIndex,
): string {
  const busca = buscarCadastroIndexed(
    index,
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  if (busca.kind === 'found') return busca.cadastro.id;
  const d = nipDigitos(r.nip ?? '');
  if (d.length >= 8) return `nip:${d}`;
  const n = (r.nome ?? '').trim().toLowerCase();
  if (n.length >= 2) return `nome:${n}`;
  return '';
}

/** Pré-computa chaves de participante por tipo — evita O(C×S×R) no loop de virtuais. */
function buildParticipantesPorTipo(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  index: CadastroLookupIndex,
): Map<TipoProvaAplicada, Set<string>> {
  const out = new Map<TipoProvaAplicada, Set<string>>();
  for (const sessao of sessoes) {
    let set = out.get(sessao.tipoProva);
    if (!set) {
      set = new Set();
      out.set(sessao.tipoProva, set);
    }
    for (const r of sessao.resultados ?? []) {
      const id = idParticipanteSessao(r, cadastros, index);
      if (id) set.add(id);
    }
  }
  return out;
}

function resultadoCorridaFromCadastro(
  c: CadastroItemPersist,
  tipo: 'corrida' | 'natacao' | 'caminhada',
  corredor: number,
): ResultadoCorridaItem | null {
  const tempo =
    tipo === 'corrida'
      ? c.tempoCorrida
      : tipo === 'natacao'
        ? c.tempoNatacao
        : c.tempoCaminhada;
  const nota =
    tipo === 'corrida'
      ? c.notaCorrida
      : tipo === 'natacao'
        ? c.notaNatacao
        : c.notaCaminhada;
  const tempoTrim = tempo?.trim();
  const notaTrim = nota?.trim();
  if (!tempoTrim && !notaTrim) return null;

  const ms = tempoTrim ? (tempoStringParaMsProva(tempoTrim) ?? 0) : 0;
  const rubrica =
    tipo === 'corrida'
      ? c.rubricaCorridaSvg
      : tipo === 'natacao'
        ? c.rubricaNatacaoSvg
        : c.rubricaCaminhadaSvg;
  return {
    corredor,
    nome: (c.nome ?? '').trim() || '—',
    nip: c.nip ?? '',
    tempoMs: ms,
    prova: tipo,
    notaTexto: notaTrim || undefined,
    rubricaCandidatoSvg: rubrica,
  };
}

function resultadoPermanenciaFromCadastro(
  c: CadastroItemPersist,
  corredor: number,
): ResultadoCorridaItem | null {
  const r = c.resultadoPermanencia ?? c.resultadoNatacao;
  const tempo = (c.tempoPermanencia ?? '').trim();
  if (r !== 'aprovado' && r !== 'reprovado' && !tempo) return null;

  const ms = tempo ? (tempoStringParaMsProva(tempo) ?? 10 * 60 * 1000) : 10 * 60 * 1000;
  const reprovado = r === 'reprovado';
  return {
    corredor,
    nome: (c.nome ?? '').trim() || '—',
    nip: c.nip ?? '',
    tempoMs: ms,
    prova: 'permanencia',
    notaTexto: reprovado ? 'REPROVADO' : 'Aprovado',
    reprovacaoTexto: reprovado ? 'Reprovado' : undefined,
    rubricaCandidatoSvg: c.rubricaPermanenciaSvg,
  };
}

function dataModalidadeCadastro(c: CadastroItemPersist, tipo: TipoProvaAplicada): string | null {
  switch (tipo) {
    case 'corrida':
      return c.dataTafCorrida?.trim() || null;
    case 'natacao':
      return c.dataTafNatacao?.trim() || null;
    case 'permanencia':
      return c.dataTafPermanencia?.trim() || null;
    case 'caminhada':
      return c.dataTafCaminhada?.trim() || null;
    default:
      return null;
  }
}

/** Data da aplicação para sessão; usa hoje se o cadastro tem resultado mas perdeu a data. */
function dataModalidadeParaSessao(c: CadastroItemPersist, tipo: TipoProvaAplicada): string | null {
  const data = dataModalidadeCadastro(c, tipo);
  if (data && dataBrParaIso(data)) return data;
  if (cadastroTemModalidade(c, tipo)) return dataHojeBr();
  return null;
}

function cadastroTemModalidade(c: CadastroItemPersist, tipo: TipoProvaAplicada): boolean {
  switch (tipo) {
    case 'corrida':
      return temAvaliacaoCorrida(c);
    case 'natacao':
      return temAvaliacaoNatacao(c);
    case 'permanencia':
      return temAvaliacaoPermanencia(c);
    case 'caminhada':
      return temAvaliacaoCaminhada(c);
    default:
      return false;
  }
}

function resultadoFromCadastro(
  c: CadastroItemPersist,
  tipo: TipoProvaAplicada,
  corredor: number,
): ResultadoCorridaItem | null {
  if (tipo === 'corrida') return resultadoCorridaFromCadastro(c, 'corrida', corredor);
  if (tipo === 'natacao') return resultadoCorridaFromCadastro(c, 'natacao', corredor);
  if (tipo === 'caminhada') return resultadoCorridaFromCadastro(c, 'caminhada', corredor);
  return resultadoPermanenciaFromCadastro(c, corredor);
}

function cadastroSuprimidoPorSessaoExcluida(
  cadastroId: string,
  tipo: TipoProvaAplicada,
  excluidosPorTipo: Map<TipoProvaAplicada, Set<string>>,
  idsPersistidosExcluidos: Set<string>,
): boolean {
  const persistedId = `${SESSAO_REGISTRADOR_ID_PREFIX}${cadastroId}-${tipo}`;
  if (idsPersistidosExcluidos.has(persistedId)) return true;
  return excluidosPorTipo.get(tipo)?.has(cadastroId) ?? false;
}

/** Gera sessões virtuais a partir do Registrador de TAF (dados só no cadastro). */
export function gerarSessoesVirtuaisFromCadastros(
  cadastros: CadastroItemPersist[],
  sessoesReais: SessaoAplicacaoTaf[],
  sessoesExcluidas: SessaoAplicacaoTaf[] = [],
): SessaoAplicacaoTaf[] {
  const index = buildCadastroLookupIndex(cadastros);
  const reaisPorTipo = buildParticipantesPorTipo(sessoesReais, cadastros, index);
  const excluidosPorTipo = buildParticipantesPorTipo(sessoesExcluidas, cadastros, index);
  const idsPersistidosExcluidos = new Set(
    sessoesExcluidas.map((s) => s.id).filter((id) => id.startsWith(SESSAO_REGISTRADOR_ID_PREFIX)),
  );
  const grupos = new Map<string, { data: string; tipo: TipoProvaAplicada; resultados: ResultadoCorridaItem[] }>();

  for (const c of cadastros) {
    for (const tipo of ['corrida', 'natacao', 'permanencia', 'caminhada'] as const) {
      if (!cadastroTemModalidade(c, tipo)) continue;
      if (reaisPorTipo.get(tipo)?.has(c.id)) continue;
      if (cadastroSuprimidoPorSessaoExcluida(c.id, tipo, excluidosPorTipo, idsPersistidosExcluidos)) {
        continue;
      }

      const data = dataModalidadeParaSessao(c, tipo);
      if (!data) continue;

      const chave = `${tipo}:${data}`;
      let grupo = grupos.get(chave);
      if (!grupo) {
        grupo = { data, tipo, resultados: [] };
        grupos.set(chave, grupo);
      }

      const resultado = resultadoFromCadastro(c, tipo, grupo.resultados.length + 1);
      if (resultado) grupo.resultados.push(resultado);
    }
  }

  const virtuais: SessaoAplicacaoTaf[] = [];
  for (const [chave, grupo] of grupos) {
    if (grupo.resultados.length === 0) continue;
    const iso = dataBrParaIso(grupo.data)!;
    virtuais.push({
      id: `${SESSAO_REGISTRADOR_ID_PREFIX}${chave}`,
      criadoEm: `${iso}T12:00:00.000Z`,
      dataAplicacao: grupo.data,
      tipoProva: grupo.tipo,
      resultados: grupo.resultados,
    });
  }

  return virtuais.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Sessões reais + virtuais do Registrador, para abas de Resultados. */
export function unificarSessoesComCadastroRegistrador(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  sessoesExcluidas: SessaoAplicacaoTaf[] = [],
): SessaoAplicacaoTaf[] {
  // Mantém aplicações normais e sessões persistidas do Registrador/manual.
  const reais = sessoes.filter(
    (s) => !isSessaoVirtualRegistrador(s) || isSessaoPersistidaRegistrador(s),
  );
  const virtuais = gerarSessoesVirtuaisFromCadastros(cadastros, reais, sessoesExcluidas);
  return [...reais, ...virtuais].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Cria/atualiza sessões de grupo a partir de um cadastro recém-atualizado no Registrador. */
export async function persistirSessoesRegistradorFromCadastro(
  c: CadastroItemPersist,
  _addSessao: (
    input: Omit<SessaoAplicacaoTaf, 'id' | 'criadoEm'> & { id?: string },
  ) => Promise<string>,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<void> {
  const tipos: TipoProvaAplicada[] = ['corrida', 'natacao', 'permanencia', 'caminhada'];
  for (const tipo of tipos) {
    if (!cadastroTemModalidade(c, tipo)) continue;
    const data = dataModalidadeParaSessao(c, tipo);
    if (!data) continue;
    const resultado = resultadoFromCadastro(c, tipo, 1);
    if (!resultado) continue;
    await upsertParticipanteSessaoGrupoHistorico({
      dataAplicacao: data,
      tipoProva: tipo,
      normaTaf: 'armada',
      resultado,
      aplicadorAssinatura,
    });
  }
}
