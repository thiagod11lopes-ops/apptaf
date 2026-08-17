import { nipDigitos } from './nipFormat';
import { listSessaoRubricasLocal } from '../offline-first/db/localDbRubricas';
import { ANONYMOUS_OWNER, resolveOwnerUid } from '../offline-first/db/localDb';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { isRubricaImagemDataUrl, preferRubrica } from './rubricaPresence';
import { yieldToUi } from './yieldToUi';

export type RubricasPorNip = {
  corrida?: string;
  caminhada?: string;
  natacao?: string;
  permanencia?: string;
};

/** Conta logada + dados criados sem login (`__local__`). Sem login: só `__local__`. */
export function ownersParaLeituraRubricasLocal(ownerUid?: string | null): string[] {
  const owner = resolveOwnerUid(ownerUid);
  if (owner === ANONYMOUS_OWNER) return [ANONYMOUS_OWNER];
  return [owner, ANONYMOUS_OWNER];
}

/**
 * Rúbricas das sessões — side table local (imagens reais para PDF).
 * `nipsFiltro`: quando informado, só materializa esses NIPs (sob demanda).
 */
export async function carregarRubricasDasSessoesPorNip(
  nipsFiltro?: Iterable<string>,
): Promise<Map<string, RubricasPorNip>> {
  const map = new Map<string, RubricasPorNip>();
  const owners = ownersParaLeituraRubricasLocal(getCachedDataOwnerUid());

  const allowed =
    nipsFiltro != null
      ? new Set(
          [...nipsFiltro]
            .map((n) => nipDigitos(n))
            .filter((d) => d.length >= 8),
        )
      : null;
  if (allowed && allowed.size === 0) return map;

  const batches = await Promise.all(owners.map((uid) => listSessaoRubricasLocal(uid)));
  const rows = batches.flat();
  for (let i = 0; i < rows.length; i += 1) {
    if (i > 0 && i % 24 === 0) await yieldToUi();
    const row = rows[i]!;
    for (const r of row.resultados ?? []) {
      const svg = r.rubricaCandidatoSvg?.trim();
      if (!isRubricaImagemDataUrl(svg)) continue;
      const key = nipDigitos(r.nip);
      if (!key) continue;
      if (allowed && !allowed.has(key)) continue;
      const prova = r.prova;
      const atual = map.get(key) ?? {};
      if (prova === 'natacao') atual.natacao = preferRubrica(svg, atual.natacao);
      else if (prova === 'permanencia') atual.permanencia = preferRubrica(svg, atual.permanencia);
      else if (prova === 'caminhada') atual.caminhada = preferRubrica(svg, atual.caminhada);
      else atual.corrida = preferRubrica(svg, atual.corrida);
      map.set(key, atual);
    }
  }

  return map;
}

export function rubricasDoCadastro(c: {
  rubricaCorridaSvg?: string;
  rubricaCaminhadaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaPermanenciaSvg?: string;
}): RubricasPorNip {
  const pick = (v?: string) => (isRubricaImagemDataUrl(v) ? v!.trim() : undefined);
  return {
    corrida: pick(c.rubricaCorridaSvg),
    caminhada: pick(c.rubricaCaminhadaSvg),
    natacao: pick(c.rubricaNatacaoSvg),
    permanencia: pick(c.rubricaPermanenciaSvg),
  };
}

export function mesclarRubricas(
  cadastro: RubricasPorNip,
  sessao?: RubricasPorNip,
): RubricasPorNip {
  return {
    corrida: preferRubrica(sessao?.corrida, cadastro.corrida),
    caminhada: preferRubrica(sessao?.caminhada, cadastro.caminhada),
    natacao: preferRubrica(sessao?.natacao, cadastro.natacao),
    permanencia: preferRubrica(sessao?.permanencia, cadastro.permanencia),
  };
}
