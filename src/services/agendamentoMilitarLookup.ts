/**
 * Publica NIP + dados de cadastro no Supabase para a página de agendamento
 * e importa de volta para o cadastro principal do AppTAF.
 * Necessário porque `cadastros.data` na nuvem é criptografado (E2E).
 */
import { getSupabase } from '../config/supabase';
import {
  addCadastrosEmLote,
  getAllCadastros,
  type CadastroItemPersist,
} from './cadastrosIndexedDb';
import { nomeBareSemPosto } from '../utils/formatNomeComPosto';
import { formatNipInput, nipChaveCadastro, nipDigitos } from '../utils/nipFormat';
import {
  dataNascimentoCadastroValida,
  sexoCadastroValido,
  vinculoCadastroValido,
} from '../utils/cadastroDadosTaf';

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

function postoDoCadastro(c: CadastroItemPersist): string {
  return ((c.categoria === 'Oficiais' ? c.oficial : c.praca) || '').trim();
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
    const posto = postoDoCadastro(c).toUpperCase();
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

/**
 * Importa militares da página pública de agendamento para o cadastro principal.
 * - NIP novo → cria cadastro definitivo (local + sync nuvem via fila offline-first)
 * - NIP existente → preenche apenas campos que ainda estão faltando
 */
export async function importMilitarLookupIntoCadastros(): Promise<number> {
  const sb = await requireAuthSupabase();
  const { data, error } = await sb
    .from('agendamento_militar_lookup')
    .select('nip,nome,data_nascimento,sexo,categoria,posto,vinculo,updated_at,deleted')
    .eq('deleted', false);
  if (error) {
    throw new Error(error.message || 'Falha ao buscar cadastros do agendamento.');
  }

  const rows = (data ?? []) as MilitarLookupRow[];
  if (rows.length === 0) return 0;

  const locais = await getAllCadastros();
  const byNip = new Map<string, CadastroItemPersist>();
  for (const c of locais) {
    const k = nipChaveCadastro(c.nip);
    if (k) byNip.set(k, c);
  }

  const agora = Date.now();
  const toSave: CadastroItemPersist[] = [];

  for (const row of rows) {
    const nip = nipChaveCadastro(row.nip) || (nipDigitos(row.nip).length === 8 ? nipDigitos(row.nip) : '');
    if (!nip) continue;
    const nome = String(row.nome || '').trim().toUpperCase();
    if (!nome) continue;

    const categoria: 'Oficiais' | 'Praças' =
      row.categoria === 'Oficiais' || row.categoria === 'Praças' ? row.categoria : 'Praças';
    const posto = String(row.posto || '').trim().toUpperCase();
    const sexo = row.sexo === 'M' || row.sexo === 'F' ? row.sexo : undefined;
    const vinculo = row.vinculo === 'carreira' || row.vinculo === 'rm2' ? row.vinculo : undefined;
    const dataNascimento = String(row.data_nascimento || '').trim();

    const existing = byNip.get(nip);
    if (!existing) {
      const novo: CadastroItemPersist = {
        id: `agendamento_${nip}`,
        nip: formatNipInput(nip),
        nome,
        dataNascimento: dataNascimento || '',
        categoria,
        sexo,
        oficial: categoria === 'Oficiais' ? posto || undefined : undefined,
        praca: categoria === 'Praças' ? posto || undefined : undefined,
        vinculo,
        updatedAt: agora,
      };
      toSave.push(novo);
      byNip.set(nip, novo);
      continue;
    }

    const merged: CadastroItemPersist = { ...existing };
    let changed = false;

    const nomeLocal = nomeBareSemPosto(merged.nome || '').trim();
    if (!nomeLocal && nome) {
      merged.nome = nome;
      changed = true;
    }
    if (!dataNascimentoCadastroValida(merged.dataNascimento || '') && dataNascimentoCadastroValida(dataNascimento)) {
      merged.dataNascimento = dataNascimento;
      changed = true;
    }
    if (!sexoCadastroValido(merged.sexo) && sexo) {
      merged.sexo = sexo;
      changed = true;
    }
    if (merged.categoria !== 'Oficiais' && merged.categoria !== 'Praças') {
      merged.categoria = categoria;
      changed = true;
    }
    const postoLocal = postoDoCadastro(merged);
    if (!postoLocal && posto) {
      if (merged.categoria === 'Oficiais') merged.oficial = posto;
      else merged.praca = posto;
      changed = true;
    }
    if (!vinculoCadastroValido(merged.vinculo) && vinculo) {
      merged.vinculo = vinculo;
      changed = true;
    }

    if (changed) {
      merged.updatedAt = agora;
      toSave.push(merged);
      byNip.set(nip, merged);
    }
  }

  if (toSave.length > 0) {
    await addCadastrosEmLote(toSave);
  }
  return toSave.length;
}

/** Importa da página pública e em seguida republica o lookup (ida e volta). */
export async function syncMilitarLookupComCadastros(): Promise<{
  importados: number;
  publicados: number;
}> {
  const importados = await importMilitarLookupIntoCadastros();
  const publicados = await pushMilitarLookupToSupabase();
  return { importados, publicados };
}
