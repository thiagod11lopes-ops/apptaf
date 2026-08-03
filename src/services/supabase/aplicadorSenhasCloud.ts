import { requireSupabase } from '../../config/supabase';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';

export type AplicadorSenhaCloud = {
  senha: string;
  senhaHash: string;
  updatedAt: number;
};

const TABLE = 'aplicador_senhas';

export async function setAplicadorSenhaFirestore(
  ownerUid: string,
  id: string,
  senha: string,
  senhaHash: string,
): Promise<void> {
  if (!ownerUid || !id) return;
  const senhaFmt = senha.trim();
  const hashFmt = senhaHash.trim();
  if (!senhaFmt || !hashFmt) return;
  await upsertOwnerDoc(
    TABLE,
    ownerUid,
    id,
    { id, senha: senhaFmt, senhaHash: hashFmt, updatedAt: Date.now() },
    Date.now(),
  );
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
  await setAplicadorSenhaFirestore(ownerUid, record.id, senha, senhaHash);
  return true;
}

export async function getAplicadorSenhasMapFirestore(
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

export async function deleteAplicadorSenhaFirestore(ownerUid: string, id: string): Promise<void> {
  if (!ownerUid || !id) return;
  await deleteOwnerDoc(TABLE, ownerUid, id);
}

/** Mantém API antiga usada em imports. */
export async function setAplicadorSenhaCloud(
  ownerUid: string,
  id: string,
  senha: string,
  senhaHash: string,
): Promise<void> {
  await setAplicadorSenhaFirestore(ownerUid, id, senha, senhaHash);
}
