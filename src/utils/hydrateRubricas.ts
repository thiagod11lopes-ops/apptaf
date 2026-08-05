import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import {
  getCadastroRubricasLocal,
  getSessaoRubricasLocal,
} from '../offline-first/db/localDbRubricas';
import { mergeCadastroRubricas } from './cadastroLight';
import { isRubricaImagemDataUrl } from './rubricaPresence';

/** Reaplica imagens da side table no cadastro (upload / PDF). */
export async function hydrateCadastroComRubricas(
  cadastro: CadastroItemPersist,
): Promise<CadastroItemPersist> {
  const rub = await getCadastroRubricasLocal(cadastro.id);
  if (!rub) return cadastro;
  return mergeCadastroRubricas(cadastro, rub);
}

/** Reaplica imagens da side table na sessão (upload / PDF). */
export async function hydrateSessaoComRubricas(
  sessao: SessaoAplicacaoTaf,
): Promise<SessaoAplicacaoTaf> {
  const rub = await getSessaoRubricasLocal(sessao.id);
  if (!rub) return sessao;

  const byKey = new Map(
    (rub.resultados ?? []).map((r) => [`${r.nip}:${r.prova}`, r.rubricaCandidatoSvg] as const),
  );
  const resultados = sessao.resultados.map((r) => {
    const prova = r.prova ?? sessao.tipoProva;
    const img = byKey.get(`${r.nip}:${prova}`);
    return img && isRubricaImagemDataUrl(img)
      ? { ...r, rubricaCandidatoSvg: img }
      : r;
  });

  let aplicadorAssinatura = sessao.aplicadorAssinatura;
  if (aplicadorAssinatura && isRubricaImagemDataUrl(rub.aplicadorRubricaSvg)) {
    aplicadorAssinatura = {
      ...aplicadorAssinatura,
      rubricaSvg: rub.aplicadorRubricaSvg!.trim(),
    };
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
