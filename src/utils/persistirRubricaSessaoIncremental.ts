import type { ResultadoCorridaItem } from '../navigation/types';
import type { TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { putSessaoRubricasLocal } from '../offline-first/db/localDbRubricas';
import {
  getCachedDataOwnerUid,
  resolveStorageOwnerUid,
} from '../services/firebase/authUid';
import { isRubricaImagemDataUrl } from './rubricaPresence';
import type { SessaoResultadoRubrica } from './sessaoLight';

const PROVAS_SIDE: ReadonlySet<SessaoResultadoRubrica['prova']> = new Set([
  'corrida',
  'natacao',
  'permanencia',
  'caminhada',
]);

function provaSideTable(
  resultado: ResultadoCorridaItem,
  tipoProva: TipoProvaAplicada,
): SessaoResultadoRubrica['prova'] | null {
  const raw = (resultado.prova ?? tipoProva) as SessaoResultadoRubrica['prova'];
  return PROVAS_SIDE.has(raw) ? raw : null;
}

/** Monta o registro da side table a partir de um resultado recém-confirmado. */
export function resultadoParaSessaoRubricaSideTable(
  resultado: ResultadoCorridaItem,
  tipoProva: TipoProvaAplicada,
): SessaoResultadoRubrica | null {
  const svg = (resultado.rubricaCandidatoSvg || '').trim();
  if (!isRubricaImagemDataUrl(svg)) return null;
  const prova = provaSideTable(resultado, tipoProva);
  if (!prova) return null;
  const nip = (resultado.nip || '').trim();
  if (!nip) return null;
  return { nip, prova, rubricaCandidatoSvg: svg };
}

/**
 * Grava a rúbrica de um único candidato na side table da sessão (SVG ou raster).
 * Une ao que já existia — não apaga as demais.
 */
export async function persistirRubricaCandidatoSessaoSideTable(
  sessaoId: string | null | undefined,
  resultado: ResultadoCorridaItem,
  tipoProva: TipoProvaAplicada,
): Promise<boolean> {
  const id = (sessaoId ?? '').trim();
  if (!id) return false;
  const row = resultadoParaSessaoRubricaSideTable(resultado, tipoProva);
  if (!row) return false;
  const ownerUid = getCachedDataOwnerUid() ?? (await resolveStorageOwnerUid());
  if (!ownerUid) return false;
  await putSessaoRubricasLocal(ownerUid, id, { resultados: [row] });
  return true;
}
