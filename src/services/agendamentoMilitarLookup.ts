/**
 * Publica NIP + dados de cadastro no Supabase para a página de agendamento.
 * Necessário porque `cadastros.data` na nuvem é criptografado (E2E).
 */
import { getSupabase } from '../config/supabase';
import { getAllCadastros } from './cadastrosIndexedDb';
import { nomeBareSemPosto } from '../utils/formatNomeComPosto';
import { nipChaveCadastro } from '../utils/nipFormat';

export type MilitarLookupRow = {
  nip: string;
  nome: string;
  data_nascimento: string;
  sexo: string;
  categoria: string;
  posto: string;
  vinculo: string;
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

/** Envia cadastros locais (dados mínimos) para a lookup pública. */
export async function pushMilitarLookupToSupabase(): Promise<number> {
  const sb = await requireAuthSupabase();
  const cadastros = await getAllCadastros();
  const agora = Date.now();
  const byNip = new Map<string, MilitarLookupRow>();

  for (const c of cadastros) {
    const nip = nipChaveCadastro(c.nip);
    if (!nip) continue;
    const nome = nomeBareSemPosto(c.nome || '').trim().toUpperCase() || (c.nome || '').trim().toUpperCase();
    if (!nome) continue;
    const posto = ((c.categoria === 'Oficiais' ? c.oficial : c.praca) || '').trim().toUpperCase();
    const prev = byNip.get(nip);
    if (!prev || (c.updatedAt ?? 0) >= (prev.updated_at ?? 0)) {
      byNip.set(nip, {
        nip,
        nome,
        data_nascimento: (c.dataNascimento || '').trim(),
        sexo: c.sexo === 'M' || c.sexo === 'F' ? c.sexo : '',
        categoria: c.categoria === 'Oficiais' || c.categoria === 'Praças' ? c.categoria : '',
        posto,
        vinculo: c.vinculo === 'carreira' || c.vinculo === 'rm2' ? c.vinculo : '',
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
