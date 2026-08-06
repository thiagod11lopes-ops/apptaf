import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  isRubricaImagemDataUrl,
  paraMarcadorRubrica,
  temRubricaPresente,
} from './rubricaPresence';

export type CadastroRubricas = {
  rubricaCorridaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaCaminhadaSvg?: string;
  rubricaPermanenciaSvg?: string;
};

export function extractCadastroRubricas(item: CadastroItemPersist): CadastroRubricas {
  const pick = (v?: string) => (isRubricaImagemDataUrl(v) ? v!.trim() : undefined);
  return {
    rubricaCorridaSvg: pick(item.rubricaCorridaSvg),
    rubricaNatacaoSvg: pick(item.rubricaNatacaoSvg),
    rubricaCaminhadaSvg: pick(item.rubricaCaminhadaSvg),
    rubricaPermanenciaSvg: pick(item.rubricaPermanenciaSvg),
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

/** Une modalidades; `primary` vence quando ambos têm imagem. Nunca descarta fallback sem imagem nova. */
export function mergeCadastroRubricasFields(
  fallback?: CadastroRubricas | null,
  primary?: CadastroRubricas | null,
): CadastroRubricas {
  const pick = (a?: string, b?: string) => {
    if (isRubricaImagemDataUrl(a)) return a!.trim();
    if (isRubricaImagemDataUrl(b)) return b!.trim();
    return undefined;
  };
  return {
    rubricaCorridaSvg: pick(primary?.rubricaCorridaSvg, fallback?.rubricaCorridaSvg),
    rubricaNatacaoSvg: pick(primary?.rubricaNatacaoSvg, fallback?.rubricaNatacaoSvg),
    rubricaCaminhadaSvg: pick(primary?.rubricaCaminhadaSvg, fallback?.rubricaCaminhadaSvg),
    rubricaPermanenciaSvg: pick(
      primary?.rubricaPermanenciaSvg,
      fallback?.rubricaPermanenciaSvg,
    ),
  };
}

/** Remove imagens; mantém marcador de presença quando havia rúbrica. */
export function toCadastroLight(item: CadastroItemPersist): CadastroItemPersist {
  return {
    ...item,
    rubricaCorridaSvg: paraMarcadorRubrica(item.rubricaCorridaSvg),
    rubricaNatacaoSvg: paraMarcadorRubrica(item.rubricaNatacaoSvg),
    rubricaCaminhadaSvg: paraMarcadorRubrica(item.rubricaCaminhadaSvg),
    rubricaPermanenciaSvg: paraMarcadorRubrica(item.rubricaPermanenciaSvg),
  };
}

/** Aplica marcadores a partir das imagens extraídas (side table). */
export function toCadastroLightFromRubricas(
  item: CadastroItemPersist,
  rubricas: CadastroRubricas,
): CadastroItemPersist {
  const base = toCadastroLight(item);
  return {
    ...base,
    rubricaCorridaSvg:
      paraMarcadorRubrica(rubricas.rubricaCorridaSvg) ??
      (temRubricaPresente(base.rubricaCorridaSvg) ? base.rubricaCorridaSvg : undefined),
    rubricaNatacaoSvg:
      paraMarcadorRubrica(rubricas.rubricaNatacaoSvg) ??
      (temRubricaPresente(base.rubricaNatacaoSvg) ? base.rubricaNatacaoSvg : undefined),
    rubricaCaminhadaSvg:
      paraMarcadorRubrica(rubricas.rubricaCaminhadaSvg) ??
      (temRubricaPresente(base.rubricaCaminhadaSvg) ? base.rubricaCaminhadaSvg : undefined),
    rubricaPermanenciaSvg:
      paraMarcadorRubrica(rubricas.rubricaPermanenciaSvg) ??
      (temRubricaPresente(base.rubricaPermanenciaSvg) ? base.rubricaPermanenciaSvg : undefined),
  };
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
