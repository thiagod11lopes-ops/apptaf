import type { ResultadoCorridaItem } from '../navigation/types';
import { addCadastro, getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  getAllSessoesAplicacao,
  updateSessaoAplicacao,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { nipDigitos } from './nipFormat';

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
 * sem persistir. Usado quando a gravação é adiada até a confirmação do aplicador.
 */
export function aplicarRubricasEmCadastros(
  cadastros: CadastroItemPersist[],
  resultados: ResultadoCorridaItem[],
): CadastroItemPersist[] {
  if (resultados.length === 0) return cadastros;
  const lista = [...cadastros];
  for (const r of resultados) {
    const svg = r.rubricaCandidatoSvg?.trim();
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

/** Grava rúbricas SVG no cadastro conforme a prova de cada resultado. */
export async function persistirRubricasNoCadastro(
  resultados: ResultadoCorridaItem[],
): Promise<number> {
  if (resultados.length === 0) return 0;

  const cadastros = await getAllCadastros();
  const lista: CadastroItemPersist[] = [...cadastros];
  let ok = 0;

  for (const r of resultados) {
    const svg = r.rubricaCandidatoSvg?.trim();
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
  const svgTrim = svg.trim();
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
