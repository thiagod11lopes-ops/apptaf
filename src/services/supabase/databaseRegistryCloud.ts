import { getSupabase, requireSupabase } from '../../config/supabase';
import { readAppMetaCache, writeAppMeta } from '../../offline-first/db/appMeta';

const META_PREFIX = 'database:bankCode:';

function metaKey(ownerUid: string): string {
  return `${META_PREFIX}${ownerUid.trim()}`;
}

export function formatDatabaseBankCode(bankNumber: number): string {
  if (!Number.isFinite(bankNumber) || bankNumber < 1) return '';
  return `BNC${String(Math.floor(bankNumber)).padStart(3, '0')}`;
}

export function readCachedDatabaseBankCode(ownerUid: string | null | undefined): string | null {
  const uid = (ownerUid ?? '').trim();
  if (!uid) return null;
  const raw = readAppMetaCache(metaKey(uid));
  const code = (raw ?? '').trim().toUpperCase();
  return /^BNC\d{3,}$/.test(code) ? code : null;
}

async function persistLocalBankCode(ownerUid: string, code: string): Promise<void> {
  await writeAppMeta(metaKey(ownerUid), code);
}

/**
 * Obtém ou cria o código do banco (BNC001…) na nuvem para o ownerUid (chefe).
 * Membros só leem; se o chefe ainda não registrou, retorna cache local ou null.
 */
export async function ensureDatabaseBankCode(ownerUid: string | null | undefined): Promise<string | null> {
  const uid = (ownerUid ?? '').trim();
  if (!uid) return null;

  const cached = readCachedDatabaseBankCode(uid);
  const sb = getSupabase();
  if (!sb) return cached;

  try {
    const { data, error } = await requireSupabase().rpc('ensure_database_bank_code', {
      p_owner: uid,
    });
    if (error) throw error;
    const code = typeof data === 'string' ? data.trim().toUpperCase() : '';
    if (/^BNC\d{3,}$/.test(code)) {
      await persistLocalBankCode(uid, code);
      return code;
    }
  } catch (error) {
    console.warn('[database-registry] ensure_database_bank_code falhou:', error);
  }

  // Fallback: leitura direta (RLS) se a RPC ainda não existir no projeto.
  try {
    const { data, error } = await sb
      .from('database_registry')
      .select('bank_code')
      .eq('owner_uid', uid)
      .maybeSingle();
    if (!error && data?.bank_code) {
      const code = String(data.bank_code).trim().toUpperCase();
      if (/^BNC\d{3,}$/.test(code)) {
        await persistLocalBankCode(uid, code);
        return code;
      }
    }
  } catch {
    // offline / tabela ausente
  }

  return cached;
}
