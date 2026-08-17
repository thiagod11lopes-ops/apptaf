import type { ResultadoCorridaItem } from '../navigation/types';
import type { TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { putSessaoRubricasLocal } from '../offline-first/db/localDbRubricas';
import {
  getCachedDataOwnerUid,
  resolveStorageOwnerUid,
} from '../services/firebase/authUid';
import { persistirRubricasNoCadastro } from './persistirRubricaCadastro';
import { isRubricaImagemDataUrl } from './rubricaPresence';
import {
  isRubricaRasterDataUrl,
  rubricaParaPersistenciaAsync,
} from './rubricaRasterPersist';
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

/** Raster só substitui o SVG se a conversão gerou PNG/WebP/JPEG válido. */
export function uriRubricaAposRaster(
  svgBruto: string,
  raster?: string | null,
): string {
  const bruto = svgBruto.trim();
  const next = (raster ?? '').trim();
  if (isRubricaRasterDataUrl(next)) return next;
  return bruto;
}

function resultadoComProva(
  resultado: ResultadoCorridaItem,
  tipoProva: TipoProvaAplicada,
): ResultadoCorridaItem {
  return {
    ...resultado,
    prova: resultado.prova ?? tipoProva,
  };
}

/**
 * Parte 2: SVG já está (ou entra) na side table da sessão; espelha no cadastro;
 * rasteriza em seguida e, se o WebP/PNG vier ok, substitui o SVG. Se falhar, mantém o SVG.
 * Devolve o data-URL efetivo (raster ou SVG).
 */
export async function persistirRubricaCandidatoIncremental(
  sessaoId: string | null | undefined,
  resultado: ResultadoCorridaItem,
  tipoProva: TipoProvaAplicada,
): Promise<string | undefined> {
  const comProva = resultadoComProva(resultado, tipoProva);
  const svgBruto = (comProva.rubricaCandidatoSvg || '').trim();
  if (!isRubricaImagemDataUrl(svgBruto)) return undefined;

  await persistirRubricaCandidatoSessaoSideTable(sessaoId, comProva, tipoProva);
  try {
    await persistirRubricasNoCadastro([comProva], { manterSvgBruto: true });
  } catch {
    // Sessão já tem o SVG; cadastro tenta de novo após o raster.
  }

  if (isRubricaRasterDataUrl(svgBruto)) return svgBruto;

  let raster: string | undefined;
  try {
    raster = (await rubricaParaPersistenciaAsync(svgBruto))?.trim();
  } catch {
    raster = undefined;
  }

  const efetivo = uriRubricaAposRaster(svgBruto, raster);
  if (efetivo === svgBruto) return svgBruto;

  const rasterizado = { ...comProva, rubricaCandidatoSvg: efetivo };
  await persistirRubricaCandidatoSessaoSideTable(sessaoId, rasterizado, tipoProva);
  try {
    await persistirRubricasNoCadastro([rasterizado], { manterSvgBruto: true });
  } catch {
    /* side table da sessão já tem o raster */
  }
  return efetivo;
}
