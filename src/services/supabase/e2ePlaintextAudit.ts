/**
 * Etapa 2 — auditoria e reproteção de documentos ainda em texto plano na nuvem.
 * Não apaga dados: só regrava `data` cifrado com a chave E2E ativa.
 */
import { getActiveTeamKey, isCloudDataEncrypted, maybeDecryptFromCloud } from './e2eCrypto';
import { listPlaintextCloudDocIds, upsertOwnerDoc } from './ownerDocs';
import { requireSupabase } from '../../config/supabase';

/** Coleções do LWW — reenvio via force-upload no plano de sync. */
export const E2E_LWW_PLAINTEXT_TABLES = ['cadastros', 'sessoes', 'aplicadores'] as const;

/** Demais owner_docs — regravação direta (não passam pelo plano LWW principal). */
export const E2E_DIRECT_PLAINTEXT_TABLES = [
  'pre_cadastros',
  'cadastro_rubricas',
  'sessao_rubricas',
  'aplicador_senhas',
] as const;

const TABLES_WITH_DELETED = new Set([
  'cadastros',
  'sessoes',
  'aplicadores',
  'pre_cadastros',
]);

const PAGE_SIZE = 1000;

export type PlaintextAuditSummary = {
  byTable: Record<string, number>;
  total: number;
};

export type LwwPlaintextIds = {
  cadastros: Set<string>;
  sessoes: Set<string>;
  aplicadores: Set<string>;
};

function emptyLwwIds(): LwwPlaintextIds {
  return {
    cadastros: new Set(),
    sessoes: new Set(),
    aplicadores: new Set(),
  };
}

/** Conta docs sem envelope `__e2e` nas tabelas indicadas. */
export async function countPlaintextCloudDocs(
  ownerUid: string,
  tables: readonly string[],
): Promise<PlaintextAuditSummary> {
  const byTable: Record<string, number> = {};
  let total = 0;
  for (const table of tables) {
    const ids = await listPlaintextCloudDocIds(table, ownerUid);
    byTable[table] = ids.size;
    total += ids.size;
  }
  return { byTable, total };
}

/**
 * IDs plaintext das 3 coleções LWW.
 * Sem chave E2E ativa, retorna vazios (sync já bloqueia upload sem chave).
 */
export async function listLwwPlaintextForceUploadIds(ownerUid: string): Promise<LwwPlaintextIds> {
  if (!ownerUid.trim() || !getActiveTeamKey()) return emptyLwwIds();
  const [cadastros, sessoes, aplicadores] = await Promise.all([
    listPlaintextCloudDocIds('cadastros', ownerUid),
    listPlaintextCloudDocIds('sessoes', ownerUid),
    listPlaintextCloudDocIds('aplicadores', ownerUid),
  ]);
  return { cadastros, sessoes, aplicadores };
}

function selectColumns(table: string): string {
  return TABLES_WITH_DELETED.has(table)
    ? 'id, owner_uid, data, updated_at, deleted'
    : 'id, owner_uid, data, updated_at';
}

/**
 * Regrava na nuvem (cifrado) todos os docs plaintext das tabelas “diretas”.
 * Mantém o conteúdo; só envelopa com AES-GCM.
 */
export async function reencryptDirectPlaintextTables(
  ownerUid: string,
  onProgress?: (message: string, processed: number, total: number) => void,
): Promise<PlaintextAuditSummary> {
  if (!ownerUid.trim()) {
    return { byTable: {}, total: 0 };
  }
  if (!getActiveTeamKey()) {
    throw new Error(
      'Criptografia E2E obrigatória: chave da equipe não está ativa. Saia e entre novamente com e-mail e senha.',
    );
  }

  const sb = requireSupabase();
  const byTable: Record<string, number> = {};
  let total = 0;

  for (const table of E2E_DIRECT_PLAINTEXT_TABLES) {
    let reencrypted = 0;
    let from = 0;
    for (;;) {
      const { data, error } = await sb
        .from(table)
        .select(selectColumns(table))
        .eq('owner_uid', ownerUid)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const chunk = (data ?? []) as Array<{
        id: string;
        data: Record<string, unknown>;
        updated_at: number;
        deleted?: boolean;
      }>;
      for (const row of chunk) {
        if (isCloudDataEncrypted(row.data ?? {})) continue;
        const plain = await maybeDecryptFromCloud(row.data ?? {});
        const { id: _id, deleted: _del, updatedAt: _ua, ...rest } = plain as Record<string, unknown> & {
          id?: string;
          deleted?: boolean;
          updatedAt?: number;
        };
        const now = Date.now();
        await upsertOwnerDoc(
          table,
          ownerUid,
          row.id,
          { ...rest, updatedAt: now },
          now,
          row.deleted === true,
        );
        reencrypted += 1;
        total += 1;
        onProgress?.(
          `Protegendo dados antigos na nuvem (${table})…`,
          total,
          Math.max(total, reencrypted),
        );
      }
      if (chunk.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    byTable[table] = reencrypted;
  }

  return { byTable, total };
}

/** Resumo textual para log / UI. */
export function formatPlaintextAuditSummary(summary: PlaintextAuditSummary): string {
  if (summary.total <= 0) return 'Nenhum registro em texto plano na nuvem.';
  const parts = Object.entries(summary.byTable)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `${table}:${n}`);
  return `${summary.total} registro(s) em texto plano (${parts.join(', ')})`;
}
