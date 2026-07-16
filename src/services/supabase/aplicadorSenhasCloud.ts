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
  await upsertOwnerDoc(
    TABLE,
    ownerUid,
    id,
    { id, senha, senhaHash, updatedAt: Date.now() },
    Date.now(),
  );
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
