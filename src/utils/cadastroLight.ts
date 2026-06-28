import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

export type CadastroRubricas = {
  rubricaCorridaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaCaminhadaSvg?: string;
  rubricaPermanenciaSvg?: string;
};

export function extractCadastroRubricas(item: CadastroItemPersist): CadastroRubricas {
  return {
    rubricaCorridaSvg: item.rubricaCorridaSvg,
    rubricaNatacaoSvg: item.rubricaNatacaoSvg,
    rubricaCaminhadaSvg: item.rubricaCaminhadaSvg,
    rubricaPermanenciaSvg: item.rubricaPermanenciaSvg,
  };
}

export function hasCadastroRubricas(r: CadastroRubricas): boolean {
  return !!(
    r.rubricaCorridaSvg ||
    r.rubricaNatacaoSvg ||
    r.rubricaCaminhadaSvg ||
    r.rubricaPermanenciaSvg
  );
}

/** Remove SVGs do cadastro (carga leve / cache). */
export function toCadastroLight(item: CadastroItemPersist): CadastroItemPersist {
  const {
    rubricaCorridaSvg: _c,
    rubricaNatacaoSvg: _n,
    rubricaCaminhadaSvg: _w,
    rubricaPermanenciaSvg: _p,
    ...light
  } = item;
  return light;
}

export function mergeCadastroRubricas(
  item: CadastroItemPersist,
  rubricas: CadastroRubricas,
): CadastroItemPersist {
  return {
    ...item,
    rubricaCorridaSvg: rubricas.rubricaCorridaSvg ?? item.rubricaCorridaSvg,
    rubricaNatacaoSvg: rubricas.rubricaNatacaoSvg ?? item.rubricaNatacaoSvg,
    rubricaCaminhadaSvg: rubricas.rubricaCaminhadaSvg ?? item.rubricaCaminhadaSvg,
    rubricaPermanenciaSvg: rubricas.rubricaPermanenciaSvg ?? item.rubricaPermanenciaSvg,
  };
}
