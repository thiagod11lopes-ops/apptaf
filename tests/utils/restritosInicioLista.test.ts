import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { RestritoRegistro } from '../../src/services/restritosStorage';
import {
  montarListaRestritosInicio,
  textoSituacaoRestrito,
} from '../../src/utils/restritosInicioLista';
import { buildRestritosTafHtml } from '../../src/utils/exportRestritosTafPdf';

function cadastro(partial: Partial<CadastroItemPersist> & { nip: string; nome: string }): CadastroItemPersist {
  return {
    id: partial.id ?? `c-${partial.nip}`,
    nip: partial.nip,
    nome: partial.nome,
    dataNascimento: partial.dataNascimento ?? '01/01/1990',
    categoria: partial.categoria ?? 'Praças',
    praca: partial.praca,
    oficial: partial.oficial,
  };
}

function restrito(
  partial: Pick<RestritoRegistro, 'nip' | 'nome'> & Partial<RestritoRegistro>,
): RestritoRegistro {
  return {
    nip: partial.nip,
    nome: partial.nome,
    dataInicio: partial.dataInicio ?? '01/01/2026',
    dataFim: partial.dataFim ?? '31/12/2026',
    updatedAt: partial.updatedAt ?? 1,
    deleted: partial.deleted,
  };
}

describe('montarListaRestritosInicio', () => {
  it('lista todos os cadastrados como restrito, ordenados por nome', () => {
    const lista = montarListaRestritosInicio(
      [
        restrito({ nip: '22334455', nome: 'Bruno' }),
        restrito({ nip: '11223344', nome: 'Ana' }),
        restrito({ nip: '99887766', nome: 'Carla', deleted: true }),
      ],
      [cadastro({ nip: '11.2233.44', nome: 'Ana Silva', praca: 'MN' })],
      '17/08/2026',
    );

    expect(lista.map((r) => r.nome)).toEqual(['Ana', 'Bruno']);
    expect(lista[0]!.nip).toBe('11.2233.44');
    expect(lista[0]!.postoGrad).toBe('MN');
    expect(lista[0]!.ativa).toBe(true);
    expect(textoSituacaoRestrito(lista[0]!)).toBe('Ativa');
  });

  it('marca como agendada quando a dispensa ainda não começou', () => {
    const lista = montarListaRestritosInicio(
      [restrito({ nip: '11223344', nome: 'Ana', dataInicio: '01/09/2026', dataFim: '30/09/2026' })],
      [],
      '17/08/2026',
    );
    expect(lista).toHaveLength(1);
    expect(lista[0]!.ativa).toBe(false);
    expect(textoSituacaoRestrito(lista[0]!)).toBe('Agendada');
  });
});

describe('buildRestritosTafHtml', () => {
  it('inclui nome, NIP e período no HTML do PDF', () => {
    const html = buildRestritosTafHtml([
      {
        nipKey: '11223344',
        nip: '11.2233.44',
        nome: 'Ana Silva',
        postoGrad: 'MN',
        dataInicio: '01/01/2026',
        dataFim: '31/12/2026',
        ativa: true,
      },
    ]);
    expect(html).toContain('Ana Silva');
    expect(html).toContain('11.2233.44');
    expect(html).toContain('01/01/2026');
    expect(html).toContain('Ativa');
    expect(html).toContain('Militares restritos no TAF');
  });
});
