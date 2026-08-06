import type { ResultadoCorridaItem } from '../navigation/types';
import { addCadastro, getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { peekCadastrosListCache } from '../services/cadastrosListCache';
import {
  getAllSessoesAplicacao,
  updateSessaoAplicacao,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { nipDigitos } from './nipFormat';
import {
  isRubricaRasterDataUrl,
  rubricaParaPersistencia,
  rubricaParaPersistenciaAsync,
} from './rubricaRasterPersist';

function patchRubricaPorProva(
  prova: ResultadoCorridaItem['prova'],
  svg: string,
): Partial<CadastroItemPersist> {
  const p = prova ?? 'corrida';
  return p === 'natacao'
    ? { rubricaNatacaoSvg: svg }
    : p === 'permanencia'
      ? { rubricaPermanenciaSvg: svg }
      : p === 'caminhada'
        ? { rubricaCaminhadaSvg: svg }
        : { rubricaCorridaSvg: svg };
}

/**
 * Aplica as rúbricas SVG dos candidatos sobre uma lista de cadastros EM MEMÓRIA,
 * sem persistir (útil para mesclar antes de um upsert).
 */
export function aplicarRubricasEmCadastros(
  cadastros: CadastroItemPersist[],
  resultados: ResultadoCorridaItem[],
): CadastroItemPersist[] {
  if (resultados.length === 0) return cadastros;
  const lista = [...cadastros];
  for (const r of resultados) {
    const svg = rubricaParaPersistencia(r.rubricaCandidatoSvg)?.trim();
    if (!svg) continue;
    let busca = buscarCadastroPorNomeOuNip(lista, r.nip);
    if (busca.kind !== 'found' && r.nome.trim()) {
      busca = buscarCadastroPorNomeOuNip(lista, r.nome);
    }
    if (busca.kind !== 'found') continue;
    const atualizado: CadastroItemPersist = {
      ...busca.cadastro,
      ...patchRubricaPorProva(r.prova, svg),
    };
    const idx = lista.findIndex((c) => c.id === atualizado.id);
    if (idx >= 0) lista[idx] = atualizado;
  }
  return lista;
}

export type PersistirRubricasOpcoes = {
  /**
   * Grava o data-URL como veio (SVG bruto), sem canvas/WebP.
   * Use no “Próximo” do fluxo de candidatos para não engasgar.
   */
  manterSvgBruto?: boolean;
};

/** Grava rúbricas SVG no cadastro conforme a prova de cada resultado. */
export async function persistirRubricasNoCadastro(
  resultados: ResultadoCorridaItem[],
  opcoes?: PersistirRubricasOpcoes,
): Promise<number> {
  if (resultados.length === 0) return 0;

  const peeked = peekCadastrosListCache();
  const cadastros = peeked ?? (await getAllCadastros());
  const lista: CadastroItemPersist[] = [...cadastros];
  let ok = 0;
  const manterSvgBruto = opcoes?.manterSvgBruto === true;

  for (const r of resultados) {
    const bruto = (r.rubricaCandidatoSvg || '').trim();
    if (!bruto) continue;
    // Já rasterizada no caller, ou gravando SVG bruto no fluxo “Próximo”.
    const svg = manterSvgBruto || isRubricaRasterDataUrl(bruto)
      ? bruto
      : (await rubricaParaPersistenciaAsync(bruto))?.trim();
    if (!svg) continue;

    let busca = buscarCadastroPorNomeOuNip(lista, r.nip);
    if (busca.kind !== 'found' && r.nome.trim()) {
      busca = buscarCadastroPorNomeOuNip(lista, r.nome);
    }
    if (busca.kind !== 'found') continue;

    const prova = r.prova ?? 'corrida';
    const patch: Partial<CadastroItemPersist> =
      prova === 'natacao'
        ? { rubricaNatacaoSvg: svg }
        : prova === 'permanencia'
          ? { rubricaPermanenciaSvg: svg }
          : prova === 'caminhada'
            ? { rubricaCaminhadaSvg: svg }
            : { rubricaCorridaSvg: svg };

    const atualizado: CadastroItemPersist = { ...busca.cadastro, ...patch };
    await addCadastro(atualizado);
    const idx = lista.findIndex((c) => c.id === atualizado.id);
    if (idx >= 0) lista[idx] = atualizado;
    ok += 1;
  }

  return ok;
}

/**
 * Grava/substitui a rúbrica de uma modalidade no cadastro e nas sessões do histórico
 * com o mesmo NIP e tipo de prova.
 */
export async function persistirRubricaModalidadeParticipante(
  nip: string,
  nome: string,
  modalidade: TipoProvaAplicada,
  svg: string,
): Promise<{ cadastroOk: boolean; sessoesAtualizadas: number }> {
  const svgTrim = (await rubricaParaPersistenciaAsync(svg))?.trim() ?? '';
  if (!svgTrim) return { cadastroOk: false, sessoesAtualizadas: 0 };

  const cadastroOk =
    (await persistirRubricasNoCadastro([
      {
        corredor: 1,
        nome: nome.trim() || 'Militar',
        nip: nip.trim(),
        tempoMs: 0,
        prova: modalidade,
        rubricaCandidatoSvg: svgTrim,
        rubricaCandidato: 'Rúbrica capturada',
      },
    ])) > 0;

  const alvo = nipDigitos(nip);
  let sessoesAtualizadas = 0;
  if (alvo) {
    const sessoes = await getAllSessoesAplicacao();
    for (const sessao of sessoes) {
      if (sessao.tipoProva !== modalidade) continue;
      let mudou = false;
      const resultados = sessao.resultados.map((r) => {
        if (nipDigitos(r.nip) !== alvo) return r;
        mudou = true;
        return {
          ...r,
          rubricaCandidatoSvg: svgTrim,
          rubricaCandidato: 'Rúbrica capturada',
        };
      });
      if (!mudou) continue;
      await updateSessaoAplicacao({ ...sessao, resultados });
      sessoesAtualizadas += 1;
    }
  }

  return { cadastroOk, sessoesAtualizadas };
}
