import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { FirestoreTombstoneFields } from '../offline-first/sync/tombstone';

export type SessaoResultadoRubrica = {
  nip: string;
  prova: 'corrida' | 'natacao' | 'permanencia';
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
    if (!svg) continue;
    const prova = r.prova ?? normalized.tipoProva;
    out.push({ nip: r.nip, prova, rubricaCandidatoSvg: svg });
  }
  return out;
}

export function toSessaoLight(sessao: SessaoAplicacaoTaf): SessaoAplicacaoTaf {
  const base = normalizeSessaoShape(sessao);
  return {
    ...base,
    resultados: base.resultados.map((r) => {
      const { rubricaCandidatoSvg: _r, ...rest } = r;
      return rest as ResultadoCorridaItem;
    }),
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
