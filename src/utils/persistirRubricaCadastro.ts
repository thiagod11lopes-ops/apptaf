import type { ResultadoCorridaItem } from '../navigation/types';
import { addCadastro, getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';

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
          : { rubricaCorridaSvg: svg };

    const atualizado: CadastroItemPersist = { ...busca.cadastro, ...patch };
    await addCadastro(atualizado);
    const idx = lista.findIndex((c) => c.id === atualizado.id);
    if (idx >= 0) lista[idx] = atualizado;
    ok += 1;
  }

  return ok;
}
