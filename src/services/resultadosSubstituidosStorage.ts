import type { TipoProvaAplicada } from './resultadosAplicadosIndexedDb';
import { tituloTipoProva } from './resultadosAplicadosIndexedDb';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { nipDigitos, formatNipInput } from '../utils/nipFormat';
import { ANONYMOUS_OWNER } from '../offline-first/db/localDb';

export type ResultadoSubstituidoRecord = {
  id: string;
  ownerUid: string;
  cadastroId?: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  modalidade: TipoProvaAplicada;
  modalidadeLabel: string;
  dataAplicacao: string;
  tempo: string;
  nota: string;
  situacao: string;
  /** Quando o resultado foi arquivado por substituição. */
  replacedAt: number;
  sessaoId?: string;
};

export type ResultadoSubstituidoInput = {
  cadastroId?: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  modalidade: TipoProvaAplicada;
  dataAplicacao: string;
  tempo: string;
  nota: string;
  situacao: string;
  sessaoId?: string;
  replacedAt?: number;
};

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ownerUidAtual(): string {
  return getCachedDataOwnerUid() || ANONYMOUS_OWNER;
}

export async function arquivarResultadosSubstituidos(
  inputs: ResultadoSubstituidoInput[],
): Promise<void> {
  const db = getTafDatabase();
  if (!db || inputs.length === 0) return;
  const ownerUid = ownerUidAtual();
  const now = Date.now();
  const rows: ResultadoSubstituidoRecord[] = inputs.map((input) => ({
    id: newId(),
    ownerUid,
    cadastroId: input.cadastroId,
    nip: formatNipInput(nipDigitos(input.nip)) || (input.nip || '').trim() || '—',
    nome: (input.nome || '').trim() || '—',
    postoGrad: (input.postoGrad || '').trim() || undefined,
    modalidade: input.modalidade,
    modalidadeLabel: tituloTipoProva(input.modalidade),
    dataAplicacao: (input.dataAplicacao || '').trim() || '—',
    tempo: (input.tempo || '').trim() || '—',
    nota: (input.nota || '').trim() || '—',
    situacao: (input.situacao || '').trim() || '—',
    replacedAt: input.replacedAt ?? now,
    sessaoId: input.sessaoId,
  }));
  await db.resultadosSubstituidos.bulkPut(rows);
}

export async function listarResultadosSubstituidos(opts?: {
  nip?: string;
  cadastroId?: string;
}): Promise<ResultadoSubstituidoRecord[]> {
  const db = getTafDatabase();
  if (!db) return [];
  const ownerUid = ownerUidAtual();
  const all = await db.resultadosSubstituidos.where('ownerUid').equals(ownerUid).toArray();
  const nipKey = nipDigitos(opts?.nip ?? '');
  const cadastroId = (opts?.cadastroId ?? '').trim();
  const filtrados = all.filter((row) => {
    if (cadastroId && row.cadastroId === cadastroId) return true;
    if (nipKey && nipDigitos(row.nip) === nipKey) return true;
    if (!cadastroId && !nipKey) return true;
    return false;
  });
  filtrados.sort((a, b) => b.replacedAt - a.replacedAt || a.nome.localeCompare(b.nome, 'pt-BR'));
  return filtrados;
}

export type MilitarComHistoricoSubstituido = {
  key: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  cadastroId?: string;
  total: number;
  itens: ResultadoSubstituidoRecord[];
};

/** Remove o histórico substituído do aparelho — exclusão definitiva. */
export async function excluirResultadoSubstituido(id: string): Promise<void> {
  const db = getTafDatabase();
  const key = (id || '').trim();
  if (!db || !key) return;
  await db.resultadosSubstituidos.delete(key);
}

export async function listarMilitaresComHistoricoSubstituido(): Promise<
  MilitarComHistoricoSubstituido[]
> {
  const rows = await listarResultadosSubstituidos();
  const byKey = new Map<string, MilitarComHistoricoSubstituido>();
  for (const row of rows) {
    const key = row.cadastroId || nipDigitos(row.nip) || row.id;
    const atual = byKey.get(key);
    if (!atual) {
      byKey.set(key, {
        key,
        nip: row.nip,
        nome: row.nome,
        postoGrad: row.postoGrad,
        cadastroId: row.cadastroId,
        total: 1,
        itens: [row],
      });
      continue;
    }
    atual.total += 1;
    atual.itens.push(row);
    if (!atual.postoGrad && row.postoGrad) atual.postoGrad = row.postoGrad;
    if ((!atual.nome || atual.nome === '—') && row.nome && row.nome !== '—') {
      atual.nome = row.nome;
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
