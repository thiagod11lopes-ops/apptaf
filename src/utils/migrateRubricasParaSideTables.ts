import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import {
  getAplicadorRaw,
  listCadastros,
  listSessoes,
  putCadastroRecord,
  putSessaoRecord,
} from '../offline-first/db/localDb';
import {
  getSessaoRubricasLocal,
  putCadastroRubricasLocal,
  putSessaoRubricasLocal,
} from '../offline-first/db/localDbRubricas';
import {
  extractCadastroRubricas,
  hasCadastroRubricas,
  toCadastroLightFromRubricas,
} from './cadastroLight';
import { mergeSessaoResultadoRubricas, pickAplicadorRubricaSvg } from './mergeSessaoRubricas';
import {
  extractSessaoAplicadorRubrica,
  extractSessaoRubricas,
  toSessaoLightComMarcadores,
} from './sessaoLight';
import { isRubricaImagemDataUrl, temRubricaPresente } from './rubricaPresence';

function metaKey(ownerUid: string): string {
  // v2: não apaga side table; recupera aplicador do cadastro de aplicadores.
  return `rubricas_side_v2:${ownerUid}`;
}

/**
 * Extrai imagens embutidas para side tables e deixa marcador nos docs principais.
 */
export async function migrateRubricasParaSideTables(
  ownerUid: string | null | undefined,
): Promise<{ sessoes: number; cadastros: number; skipped: boolean }> {
  const uid = ownerUid?.trim();
  if (!uid) return { sessoes: 0, cadastros: 0, skipped: true };

  const done = await readAppMeta(metaKey(uid));
  if (done === '1') return { sessoes: 0, cadastros: 0, skipped: true };

  let sessoes = 0;
  let cadastros = 0;

  const sessList = await listSessoes(uid, true);
  for (const sessao of sessList) {
    if (sessao.deleted) continue;
    const previous = await getSessaoRubricasLocal(sessao.id);
    const fromSessao = extractSessaoRubricas(sessao);
    const resultados = mergeSessaoResultadoRubricas(previous?.resultados, fromSessao);

    let aplicadorRubricaSvg = pickAplicadorRubricaSvg(
      extractSessaoAplicadorRubrica(sessao),
      previous?.aplicadorRubricaSvg,
    );
    const assinatura = sessao.aplicadorAssinatura;
    if (
      !aplicadorRubricaSvg &&
      assinatura &&
      temRubricaPresente(assinatura.rubricaSvg) &&
      assinatura.aplicadorId?.trim()
    ) {
      try {
        const apl = await getAplicadorRaw(assinatura.aplicadorId.trim());
        if (isRubricaImagemDataUrl(apl?.rubricaSvg)) {
          aplicadorRubricaSvg = apl!.rubricaSvg!.trim();
        }
      } catch {
        /* ignore */
      }
    }

    const needsRewrite =
      resultados.length > 0 ||
      Boolean(aplicadorRubricaSvg) ||
      sessao.resultados.some((r) => isRubricaImagemDataUrl(r.rubricaCandidatoSvg)) ||
      isRubricaImagemDataUrl(sessao.aplicadorAssinatura?.rubricaSvg) ||
      Boolean(previous);

    if (!needsRewrite) continue;

    if (resultados.length > 0 || aplicadorRubricaSvg) {
      await putSessaoRubricasLocal(uid, sessao.id, { resultados, aplicadorRubricaSvg });
    }
    const light = toSessaoLightComMarcadores(sessao, { resultados, aplicadorRubricaSvg });
    await putSessaoRecord({ ...sessao, ...light });
    sessoes += 1;
  }

  const cadList = await listCadastros(uid, true);
  for (const cadastro of cadList) {
    if (cadastro.deleted) continue;
    const rubricas = extractCadastroRubricas(cadastro);
    if (!hasCadastroRubricas(rubricas)) continue;
    await putCadastroRubricasLocal(uid, cadastro.id, rubricas);
    const light = toCadastroLightFromRubricas(cadastro, rubricas);
    await putCadastroRecord({ ...cadastro, ...light });
    cadastros += 1;
  }

  await writeAppMeta(metaKey(uid), '1');
  return { sessoes, cadastros, skipped: false };
}
