import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import {
  getCadastroRubricasLocal,
  getSessaoRubricasLocal,
} from '../offline-first/db/localDbRubricas';
import { mergeCadastroRubricas } from './cadastroLight';
import { nipDigitos } from './nipFormat';
import { isRubricaImagemDataUrl, temRubricaPresente } from './rubricaPresence';

/** Reaplica imagens da side table no cadastro (upload / PDF). */
export async function hydrateCadastroComRubricas(
  cadastro: CadastroItemPersist,
): Promise<CadastroItemPersist> {
  const rub = await getCadastroRubricasLocal(cadastro.id);
  if (!rub) return cadastro;
  return mergeCadastroRubricas(cadastro, rub);
}

function lookupRubricaCandidato(
  byKey: Map<string, string>,
  byNip: Map<string, string[]>,
  nip: string,
  prova: string,
): string | undefined {
  const nipKey = nipDigitos(nip);
  if (!nipKey) return undefined;
  const direct = byKey.get(`${nipKey}:${prova}`);
  if (direct) return direct;
  if (prova === 'corrida') {
    const cam = byKey.get(`${nipKey}:caminhada`);
    if (cam) return cam;
  }
  if (prova === 'caminhada') {
    const cor = byKey.get(`${nipKey}:corrida`);
    if (cor) return cor;
  }
  const lista = byNip.get(nipKey);
  if (lista?.length === 1) return lista[0];
  return undefined;
}

/** Reaplica imagens da side table na sessão (upload / PDF). */
export async function hydrateSessaoComRubricas(
  sessao: SessaoAplicacaoTaf,
): Promise<SessaoAplicacaoTaf> {
  const rub = await getSessaoRubricasLocal(sessao.id);

  const byKey = new Map<string, string>();
  const byNip = new Map<string, string[]>();
  for (const r of rub?.resultados ?? []) {
    if (!isRubricaImagemDataUrl(r.rubricaCandidatoSvg)) continue;
    const nipKey = nipDigitos(r.nip);
    if (!nipKey) continue;
    const img = r.rubricaCandidatoSvg.trim();
    byKey.set(`${nipKey}:${r.prova}`, img);
    const list = byNip.get(nipKey) ?? [];
    list.push(img);
    byNip.set(nipKey, list);
  }

  const resultados = sessao.resultados.map((r) => {
    const prova = r.prova ?? sessao.tipoProva;
    const img = lookupRubricaCandidato(byKey, byNip, r.nip, prova);
    return img ? { ...r, rubricaCandidatoSvg: img } : r;
  });

  let aplicadorAssinatura = sessao.aplicadorAssinatura;
  if (aplicadorAssinatura) {
    let rubricaSvg = aplicadorAssinatura.rubricaSvg;
    if (!isRubricaImagemDataUrl(rubricaSvg) && isRubricaImagemDataUrl(rub?.aplicadorRubricaSvg)) {
      rubricaSvg = rub!.aplicadorRubricaSvg!.trim();
    }
    if (!isRubricaImagemDataUrl(rubricaSvg) && aplicadorAssinatura.aplicadorId?.trim()) {
      try {
        const { getAplicadorRaw } = await import('../offline-first/db/localDb');
        const apl = await getAplicadorRaw(aplicadorAssinatura.aplicadorId.trim());
        if (isRubricaImagemDataUrl(apl?.rubricaSvg)) {
          rubricaSvg = apl!.rubricaSvg!.trim();
        }
      } catch {
        /* ignore */
      }
    }
    if (isRubricaImagemDataUrl(rubricaSvg) || temRubricaPresente(rubricaSvg)) {
      aplicadorAssinatura = { ...aplicadorAssinatura, rubricaSvg };
    }
  }

  return {
    ...sessao,
    resultados,
    ...(aplicadorAssinatura ? { aplicadorAssinatura } : {}),
  };
}

export async function hydrateSessoesComRubricas(
  sessoes: SessaoAplicacaoTaf[],
): Promise<SessaoAplicacaoTaf[]> {
  return Promise.all(sessoes.map((s) => hydrateSessaoComRubricas(s)));
}
