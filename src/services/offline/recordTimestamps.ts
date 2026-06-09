import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';

export type WithUpdatedAt = { updatedAt?: number; criadoEm?: string };

export function getRecordUpdatedAt(record: WithUpdatedAt): number {
  if (typeof record.updatedAt === 'number' && record.updatedAt > 0) {
    return record.updatedAt;
  }
  if (record.criadoEm) {
    const parsed = Date.parse(record.criadoEm);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function stampCadastro(item: CadastroItemPersist, at = Date.now()): CadastroItemPersist {
  return { ...item, updatedAt: at };
}

export function stampSessao(sessao: SessaoAplicacaoTaf, at = Date.now()): SessaoAplicacaoTaf {
  return { ...sessao, updatedAt: at };
}

/** Data da aplicação DD/MM/AAAA → timestamp para ordenação. */
export function parseDataAplicacaoBr(data: string): number {
  const m = String(data || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  const [, dd, mm, yyyy] = m;
  return Date.parse(`${yyyy}-${mm}-${dd}T12:00:00`) || 0;
}

export function getSessaoSortTime(sessao: SessaoAplicacaoTaf): number {
  return Math.max(getRecordUpdatedAt(sessao), parseDataAplicacaoBr(sessao.dataAplicacao));
}
