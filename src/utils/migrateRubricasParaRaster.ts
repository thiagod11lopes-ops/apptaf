import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import {
  listAplicadores,
  listCadastros,
  listSessoes,
  replaceAplicadorRubricaSvg,
  saveCadastro,
  saveSessao,
} from '../offline-first/db/localDb';
import { getCachedLoginUid } from '../services/firebase/authUid';
import {
  precisaRasterizarRubrica,
  rasterizarRubricasNaSessao,
  rasterizarRubricasNoCadastro,
  rubricaParaPersistencia,
} from './rubricaRasterPersist';

function metaKey(ownerUid: string): string {
  return `rubricas_raster_v1:${ownerUid}`;
}

export type MigrarRubricasRasterResult = {
  sessoes: number;
  cadastros: number;
  aplicadores: number;
  skipped: boolean;
};

function aindaTemSvg(
  sessoes: Awaited<ReturnType<typeof listSessoes>>,
  cadastros: Awaited<ReturnType<typeof listCadastros>>,
  aplicadores: Awaited<ReturnType<typeof listAplicadores>>,
): boolean {
  for (const s of sessoes) {
    if (precisaRasterizarRubrica(s.aplicadorAssinatura?.rubricaSvg)) return true;
    for (const r of s.resultados ?? []) {
      if (precisaRasterizarRubrica(r.rubricaCandidatoSvg)) return true;
    }
  }
  for (const c of cadastros) {
    if (
      precisaRasterizarRubrica(c.rubricaCorridaSvg) ||
      precisaRasterizarRubrica(c.rubricaCaminhadaSvg) ||
      precisaRasterizarRubrica(c.rubricaNatacaoSvg) ||
      precisaRasterizarRubrica(c.rubricaPermanenciaSvg)
    ) {
      return true;
    }
  }
  for (const a of aplicadores) {
    if (precisaRasterizarRubrica(a.rubricaSvg)) return true;
  }
  return false;
}

/**
 * Converte rúbricas SVG locais para WebP/PNG e enfileira sync (quando houver).
 * Só marca conclusão quando não restar SVG (permite retentar se o canvas falhar).
 */
export async function migrateRubricasSvgParaRaster(
  ownerUid: string | null | undefined,
): Promise<MigrarRubricasRasterResult> {
  const uid = ownerUid?.trim();
  if (!uid || typeof document === 'undefined') {
    return { sessoes: 0, cadastros: 0, aplicadores: 0, skipped: true };
  }

  const done = await readAppMeta(metaKey(uid));
  if (done === '1') {
    return { sessoes: 0, cadastros: 0, aplicadores: 0, skipped: true };
  }

  const userId = getCachedLoginUid();
  let sessoes = 0;
  let cadastros = 0;
  let aplicadores = 0;

  const sessList = await listSessoes(uid, false);
  for (const sessao of sessList) {
    const { sessao: next, mudou } = rasterizarRubricasNaSessao(sessao);
    if (!mudou) continue;
    await saveSessao(next, uid, userId);
    sessoes += 1;
  }

  const cadList = await listCadastros(uid, false);
  for (const cadastro of cadList) {
    const { cadastro: next, mudou } = rasterizarRubricasNoCadastro(cadastro);
    if (!mudou) continue;
    await saveCadastro(next, uid, userId);
    cadastros += 1;
  }

  const aplList = await listAplicadores(uid, false);
  for (const apl of aplList) {
    if (!precisaRasterizarRubrica(apl.rubricaSvg)) continue;
    const raster = rubricaParaPersistencia(apl.rubricaSvg);
    if (!raster || raster === apl.rubricaSvg?.trim()) continue;
    await replaceAplicadorRubricaSvg(apl.id, raster, uid, userId);
    aplicadores += 1;
  }

  const afterSess = await listSessoes(uid, false);
  const afterCad = await listCadastros(uid, false);
  const afterApl = await listAplicadores(uid, false);
  if (!aindaTemSvg(afterSess, afterCad, afterApl)) {
    await writeAppMeta(metaKey(uid), '1');
  }

  return { sessoes, cadastros, aplicadores, skipped: false };
}
