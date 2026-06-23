import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';

export type PendingOp =
  | { kind: 'upsertCadastro'; at: number; item: CadastroItemPersist }
  | { kind: 'deleteCadastro'; at: number; id: string }
  | { kind: 'upsertSessao'; at: number; sessao: SessaoAplicacaoTaf }
  | { kind: 'deleteSessao'; at: number; id: string };

export type Tombstones = {
  cadastros: Record<string, number>;
  sessoes: Record<string, number>;
};

export function emptyTombstones(): Tombstones {
  return { cadastros: {}, sessoes: {} };
}

/** Compacta fila: última operação por id prevalece. */
export function compactPendingOps(ops: PendingOp[]): PendingOp[] {
  const latest = new Map<string, PendingOp>();

  for (const op of ops) {
    let key = '';
    if (op.kind === 'upsertCadastro') key = `c:${op.item.id}`;
    if (op.kind === 'deleteCadastro') key = `c:${op.id}`;
    if (op.kind === 'upsertSessao') key = `s:${op.sessao.id}`;
    if (op.kind === 'deleteSessao') key = `s:${op.id}`;
    if (key) latest.set(key, op);
  }

  return [...latest.values()].sort((a, b) => a.at - b.at);
}

export function applyPendingToTombstones(tombstones: Tombstones, op: PendingOp): Tombstones {
  const next = {
    cadastros: { ...tombstones.cadastros },
    sessoes: { ...tombstones.sessoes },
  };
  if (op.kind === 'deleteCadastro') {
    next.cadastros[op.id] = op.at;
  }
  if (op.kind === 'deleteSessao') {
    next.sessoes[op.id] = op.at;
  }
  return next;
}

export type PendingSyncSummary = {
  total: number;
  cadastros: number;
  sessoes: number;
  exclusoes: number;
};

/** Resumo legível das alterações locais aguardando envio à nuvem. */
export function summarizePendingOps(ops: PendingOp[] | undefined): PendingSyncSummary {
  const compact = compactPendingOps(ops ?? []);
  let cadastros = 0;
  let sessoes = 0;
  let exclusoes = 0;

  for (const op of compact) {
    if (op.kind === 'upsertCadastro') cadastros += 1;
    else if (op.kind === 'deleteCadastro') exclusoes += 1;
    else if (op.kind === 'upsertSessao') sessoes += 1;
    else if (op.kind === 'deleteSessao') exclusoes += 1;
  }

  return {
    total: compact.length,
    cadastros,
    sessoes,
    exclusoes,
  };
}
