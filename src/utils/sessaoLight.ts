import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { FirestoreTombstoneFields } from '../offline-first/sync/tombstone';
import {
  isRubricaImagemDataUrl,
  paraMarcadorRubrica,
  temRubricaPresente,
} from './rubricaPresence';

export type SessaoResultadoRubrica = {
  nip: string;
  prova: 'corrida' | 'natacao' | 'permanencia' | 'caminhada';
  rubricaCandidatoSvg: string;
};

/** Garante campos mínimos — docs light/tombstone no Firestore podem omitir resultados. */
export function normalizeSessaoShape(
  sessao: Partial<SessaoAplicacaoTaf> & { id: string },
): SessaoAplicacaoTaf {
  return {
    id: sessao.id,
    criadoEm: sessao.criadoEm ?? '',
    dataAplicacao: sessao.dataAplicacao ?? '',
    tipoProva: sessao.tipoProva ?? 'corrida',
    resultados: Array.isArray(sessao.resultados) ? sessao.resultados : [],
    ...(sessao.aplicadorAssinatura ? { aplicadorAssinatura: sessao.aplicadorAssinatura } : {}),
    ...(sessao.updatedAt != null ? { updatedAt: sessao.updatedAt } : {}),
  };
}

export function extractSessaoRubricas(sessao: SessaoAplicacaoTaf): SessaoResultadoRubrica[] {
  const out: SessaoResultadoRubrica[] = [];
  const normalized = normalizeSessaoShape(sessao);
  for (const r of normalized.resultados) {
    const svg = r.rubricaCandidatoSvg?.trim();
    if (!isRubricaImagemDataUrl(svg)) continue;
    const prova = (r.prova ?? normalized.tipoProva) as SessaoResultadoRubrica['prova'];
    out.push({ nip: r.nip, prova, rubricaCandidatoSvg: svg! });
  }
  return out;
}

export function extractSessaoAplicadorRubrica(sessao: SessaoAplicacaoTaf): string | undefined {
  const svg = sessao.aplicadorAssinatura?.rubricaSvg?.trim();
  return isRubricaImagemDataUrl(svg) ? svg : undefined;
}

/** Remove imagens; mantém marcador nos campos de rúbrica. */
export function toSessaoLight(sessao: SessaoAplicacaoTaf): SessaoAplicacaoTaf {
  const base = normalizeSessaoShape(sessao);
  const aplicador = base.aplicadorAssinatura
    ? {
        ...base.aplicadorAssinatura,
        rubricaSvg: paraMarcadorRubrica(base.aplicadorAssinatura.rubricaSvg),
      }
    : undefined;
  return {
    ...base,
    resultados: base.resultados.map((r) => ({
      ...r,
      rubricaCandidatoSvg: paraMarcadorRubrica(r.rubricaCandidatoSvg),
    })),
    ...(aplicador ? { aplicadorAssinatura: aplicador } : {}),
  };
}

/** Light + marcadores a partir do pacote de rúbricas da side table / nuvem. */
export function toSessaoLightComMarcadores(
  sessao: SessaoAplicacaoTaf,
  rubDoc?: {
    resultados?: SessaoResultadoRubrica[];
    aplicadorRubricaSvg?: string;
  } | null,
): SessaoAplicacaoTaf {
  const light = toSessaoLight(sessao);
  const byKey = new Map(
    (rubDoc?.resultados ?? []).map((r) => [`${r.nip}:${r.prova}`, r.rubricaCandidatoSvg] as const),
  );
  const resultados = light.resultados.map((r) => {
    const prova = r.prova ?? light.tipoProva;
    const img = byKey.get(`${r.nip}:${prova}`);
    const marked =
      paraMarcadorRubrica(img) ??
      (temRubricaPresente(r.rubricaCandidatoSvg) ? r.rubricaCandidatoSvg : undefined);
    return marked ? { ...r, rubricaCandidatoSvg: marked } : { ...r, rubricaCandidatoSvg: undefined };
  });
  let aplicadorAssinatura = light.aplicadorAssinatura;
  if (aplicadorAssinatura) {
    const aplMarked =
      paraMarcadorRubrica(rubDoc?.aplicadorRubricaSvg) ??
      paraMarcadorRubrica(aplicadorAssinatura.rubricaSvg);
    aplicadorAssinatura = { ...aplicadorAssinatura, rubricaSvg: aplMarked };
  }
  return {
    ...light,
    resultados,
    ...(aplicadorAssinatura ? { aplicadorAssinatura } : {}),
  };
}

/** Preserva metadados de tombstone/sync ao ler sessões do Firestore. */
export function toSessaoFromFirestoreDoc(
  raw: Partial<SessaoAplicacaoTaf> & FirestoreTombstoneFields & { id: string },
): SessaoAplicacaoTaf & FirestoreTombstoneFields {
  const light = toSessaoLight(raw as SessaoAplicacaoTaf);
  if (raw.deleted !== true) {
    return {
      ...light,
      ...(raw.updatedAt != null ? { updatedAt: raw.updatedAt } : {}),
      ...(raw.syncVersion != null ? { syncVersion: raw.syncVersion } : {}),
      ...(raw.deviceId != null ? { deviceId: raw.deviceId } : {}),
      ...(raw.updatedBy != null ? { updatedBy: raw.updatedBy } : {}),
    };
  }
  return {
    ...light,
    deleted: true,
    deletedAt: raw.deletedAt ?? raw.updatedAt,
    deletedBy: raw.deletedBy,
    updatedAt: raw.updatedAt ?? light.updatedAt,
    syncVersion: raw.syncVersion,
    updatedBy: raw.updatedBy,
    deviceId: raw.deviceId,
  };
}
