import { requireSupabase } from '../../config/supabase';
import { maybeEncryptForCloud } from './e2eCrypto';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc } from './ownerDocs';

export type AplicadorSenhaCloud = {
  senha: string;
  senhaHash: string;
  updatedAt: number;
};

const TABLE = 'aplicador_senhas';

/**
 * Grava senha em texto + hash para a planilha do chefe.
 * Usa RPC security definer — autorizado consegue upsert sem SELECT na tabela.
 */
export async function setAplicadorSenhaCloud(
  ownerUid: string,
  id: string,
  senha: string,
  senhaHash: string,
): Promise<void> {
  if (!ownerUid?.trim() || !id?.trim()) {
    throw new Error('ownerUid/id obrigatórios para gravar senha do aplicador.');
  }
  const senhaFmt = senha.trim();
  const hashFmt = senhaHash.trim();
  if (!senhaFmt || !hashFmt) {
    throw new Error('senha/senhaHash obrigatórios para gravar senha do aplicador.');
  }
  const updatedAt = Date.now();
  const encrypted = await maybeEncryptForCloud({
    id,
    senha: senhaFmt,
    senhaHash: hashFmt,
    updatedAt,
  });
  const sb = requireSupabase();
  const { error } = await sb.rpc('upsert_aplicador_senha', {
    p_owner_uid: ownerUid,
    p_id: id,
    p_data: encrypted,
    p_updated_at: updatedAt,
  });
  if (error) throw new Error(error.message);
}

/**
 * Após upload do hash em `aplicadores`, espelha o texto em `aplicador_senhas`
 * para a planilha do e-mail chefe. Lança se falhar (para a sync reintentar).
 */
export async function pushAplicadorSenhaPlaintextFromRecord(
  ownerUid: string,
  record: { id: string; senha?: string; senhaHash?: string },
): Promise<boolean> {
  const senha = record.senha?.trim() ?? '';
  const senhaHash = record.senhaHash?.trim() ?? '';
  if (!ownerUid.trim() || !record.id.trim() || !senha || !senhaHash) return false;
  await setAplicadorSenhaCloud(ownerUid, record.id, senha, senhaHash);
  return true;
}

export async function getAplicadorSenhasMapCloud(
  ownerUid: string,
): Promise<Record<string, AplicadorSenhaCloud>> {
  if (!ownerUid) return {};
  try {
    const rows = await listOwnerDocs(TABLE, ownerUid);
    const map: Record<string, AplicadorSenhaCloud> = {};
    for (const row of rows) {
      const raw = rowToDoc<AplicadorSenhaCloud & { id: string }>(row);
      if (typeof raw.senha === 'string' && raw.senha.length > 0) {
        map[row.id] = {
          senha: raw.senha,
          senhaHash: typeof raw.senhaHash === 'string' ? raw.senhaHash : '',
          updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
        };
      }
    }
    return map;
  } catch {
    // Membro sem permissão de leitura — RLS bloqueia SELECT.
    return {};
  }
}

export async function deleteAplicadorSenhaCloud(ownerUid: string, id: string): Promise<void> {
  if (!ownerUid || !id) return;
  await deleteOwnerDoc(TABLE, ownerUid, id);
}

/** Aliases com nome Firestore — mantém imports existentes. */
export const setAplicadorSenhaFirestore = setAplicadorSenhaCloud;
export const getAplicadorSenhasMapFirestore = getAplicadorSenhasMapCloud;
export const deleteAplicadorSenhaFirestore = deleteAplicadorSenhaCloud;
