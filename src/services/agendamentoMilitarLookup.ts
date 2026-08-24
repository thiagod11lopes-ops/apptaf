/**
 * Publica NIP + nome de exibição no Supabase para a página de agendamento.
 * Necessário porque `cadastros.data` na nuvem é criptografado (E2E) e não
 * permite busca por NIP via SQL.
 */
import { getSupabase } from '../config/supabase';
import { getAllCadastros } from './cadastrosIndexedDb';
import { formatNomeComPosto } from '../utils/formatNomeComPosto';
import { nipChaveCadastro } from '../utils/nipFormat';

export type MilitarLookupRow = {
  nip: string;
  nome: string;
  updated_at: number;
  deleted: boolean;
};

async function requireAuthSupabase() {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase não configurado neste dispositivo.');
  }
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    throw new Error('Faça login no app para publicar o cadastro na página pública.');
  }
  return sb;
}

/** Envia todos os cadastros locais ativos (NIP + nome) para a lookup pública. */
export async function pushMilitarLookupToSupabase(): Promise<number> {
  const sb = await requireAuthSupabase();
  const cadastros = await getAllCadastros();
  const agora = Date.now();
  const byNip = new Map<string, MilitarLookupRow>();

  for (const c of cadastros) {
    const nip = nipChaveCadastro(c.nip);
    if (!nip) continue;
    const nome = formatNomeComPosto(c).trim();
    if (!nome) continue;
    const prev = byNip.get(nip);
    // Mantém o mais recente se houver duplicata de NIP
    if (!prev || (c.updatedAt ?? 0) >= (prev.updated_at ?? 0)) {
      byNip.set(nip, {
        nip,
        nome,
        updated_at: c.updatedAt ?? agora,
        deleted: false,
      });
    }
  }

  const rows = Array.from(byNip.values());
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await sb.from('agendamento_militar_lookup').upsert(chunk, {
      onConflict: 'nip',
    });
    if (error) {
      throw new Error(error.message || 'Falha ao publicar cadastros para agendamento.');
    }
  }
  return rows.length;
}
