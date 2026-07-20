import { getSupabase, requireSupabase } from '../../config/supabase';
import { readAppMetaCache, writeAppMeta } from '../../offline-first/db/appMeta';
import { isCloudOwnerUid } from '../../utils/cloudOwnerUid';
import { adminListBossEmails } from './adminDirectoryCloud';

const META_PREFIX = 'database:bankCode:';
const NEXT_LOCAL_META = 'database:nextBankNumber';

function metaKey(ownerUid: string): string {
  return `${META_PREFIX}${ownerUid.trim()}`;
}

export function formatDatabaseBankCode(bankNumber: number): string {
  if (!Number.isFinite(bankNumber) || bankNumber < 1) return '';
  return `BNC${String(Math.floor(bankNumber)).padStart(3, '0')}`;
}

function normalizeBankCode(raw: unknown): string | null {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return /^BNC\d{3,}$/.test(code) ? code : null;
}

export function readCachedDatabaseBankCode(ownerUid: string | null | undefined): string | null {
  const uid = (ownerUid ?? '').trim();
  if (!uid) return null;
  return normalizeBankCode(readAppMetaCache(metaKey(uid)));
}

async function persistLocalBankCode(ownerUid: string, code: string): Promise<void> {
  await writeAppMeta(metaKey(ownerUid), code);
}

/** Fallback local: numera bancos neste dispositivo quando a nuvem ainda não responde. */
async function allocateLocalBankCode(ownerUid: string): Promise<string> {
  const cached = readCachedDatabaseBankCode(ownerUid);
  if (cached) return cached;

  const rawNext = Number(readAppMetaCache(NEXT_LOCAL_META) || '1');
  const next = Number.isFinite(rawNext) && rawNext >= 1 ? Math.floor(rawNext) : 1;
  const code = formatDatabaseBankCode(next);
  await writeAppMeta(NEXT_LOCAL_META, String(next + 1));
  await persistLocalBankCode(ownerUid, code);
  return code;
}

/**
 * Fallback via painel admin (RPC já existente): ordem estável por created_at / owner_uid.
 * Funciona mesmo sem a tabela database_registry.
 */
async function resolveBankCodeFromBossDirectory(ownerUid: string): Promise<string | null> {
  try {
    const bosses = await adminListBossEmails();
    if (!bosses.length) {
      const code = formatDatabaseBankCode(1);
      await persistLocalBankCode(ownerUid, code);
      return code;
    }

    const sorted = [...bosses].sort((a, b) => {
      const ta = a.createdAtMs ?? Number.MAX_SAFE_INTEGER;
      const tb = b.createdAtMs ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.ownerUid.localeCompare(b.ownerUid);
    });

    let idx = sorted.findIndex((b) => b.ownerUid === ownerUid);
    if (idx < 0) idx = sorted.length;
    const code = formatDatabaseBankCode(idx + 1);
    await persistLocalBankCode(ownerUid, code);
    return code;
  } catch (error) {
    console.warn('[database-registry] fallback admin_list_boss_emails falhou:', error);
    return null;
  }
}

/**
 * Obtém ou cria o código do banco (BNC001…) na nuvem para o ownerUid (chefe).
 * Fallbacks: leitura da tabela → lista de chefes (admin) → cache/local.
 */
export async function ensureDatabaseBankCode(ownerUid: string | null | undefined): Promise<string | null> {
  const uid = (ownerUid ?? '').trim();
  if (!uid || !isCloudOwnerUid(uid)) return null;

  const cached = readCachedDatabaseBankCode(uid);
  const sb = getSupabase();
  if (!sb) return cached ?? (await allocateLocalBankCode(uid));

  try {
    const { data, error } = await requireSupabase().rpc('ensure_database_bank_code', {
      p_owner: uid,
    });
    if (error) throw error;
    const code = normalizeBankCode(data);
    if (code) {
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
    if (!error) {
      const code = normalizeBankCode(data?.bank_code);
      if (code) {
        await persistLocalBankCode(uid, code);
        return code;
      }
    }
  } catch {
    // offline / tabela ausente
  }

  if (cached) return cached;

  const fromDirectory = await resolveBankCodeFromBossDirectory(uid);
  if (fromDirectory) return fromDirectory;

  return allocateLocalBankCode(uid);
}
