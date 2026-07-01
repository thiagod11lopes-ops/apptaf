import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  filtrarCadastrosPorNorma,
  filtrarSessoesPorNorma,
  inferNormaSessao,
} from '../../src/utils/normaTafResultados';
import { montarListaPendenciasCfn } from '../../src/utils/pendenciasTafCfnHistorico';

function sessao(partial: Partial<SessaoAplicacaoTaf> & Pick<SessaoAplicacaoTaf, 'tipoProva'>): SessaoAplicacaoTaf {
  return {
    id: partial.id ?? 's1',
    criadoEm: partial.criadoEm ?? '2026-01-01T10:00:00.000Z',
    dataAplicacao: partial.dataAplicacao ?? '01/01/2026',
    tipoProva: partial.tipoProva,
    resultados: partial.resultados ?? [{ nip: '12345678', nome: 'Silva', tempoMs: 1000, notaTexto: '80' }],
    normaTaf: partial.normaTaf,
  };
}

function cadastro(partial: Partial<CadastroItemPersist>): CadastroItemPersist {
  return {
    id: partial.id ?? 'c1',
    nip: partial.nip ?? '12345678',
    nome: partial.nome ?? 'Silva',
    dataNascimento: partial.dataNascimento ?? '01/01/1990',
    categoria: partial.categoria ?? 'Praças',
    praca: partial.praca ?? 'CB',
    ...partial,
  };
}

describe('normaTafResultados', () => {
  it('inferNormaSessao: prova naval exclusiva é CFN', () => {
    expect(inferNormaSessao(sessao({ tipoProva: 'flexao_barra' }))).toBe('cfn');
  });

  it('inferNormaSessao: caminhada é Armada', () => {
    expect(inferNormaSessao(sessao({ tipoProva: 'caminhada' }))).toBe('armada');
  });

  it('inferNormaSessao: corrida legada sem tag é Armada', () => {
    expect(inferNormaSessao(sessao({ tipoProva: 'corrida' }))).toBe('armada');
  });

  it('inferNormaSessao: corrida com tag cfn é CFN', () => {
    expect(inferNormaSessao(sessao({ tipoProva: 'corrida', normaTaf: 'cfn' }))).toBe('cfn');
  });

  it('filtrarSessoesPorNorma separa armada e cfn', () => {
    const sessoes = [
      sessao({ id: 'a1', tipoProva: 'caminhada' }),
      sessao({ id: 'c1', tipoProva: 'corrida', normaTaf: 'cfn' }),
      sessao({ id: 'c2', tipoProva: 'flexao_solo' }),
    ];
    expect(filtrarSessoesPorNorma(sessoes, 'armada').map((s) => s.id)).toEqual(['a1']);
    expect(filtrarSessoesPorNorma(sessoes, 'cfn').map((s) => s.id)).toEqual(['c1', 'c2']);
  });

  it('filtrarCadastrosPorNorma inclui cadastro CFN com flexão', () => {
    const cadastros = [
      cadastro({ id: 'arm', nip: '11111111', notaCorrida: '80', tempoCorrida: '12:00' }),
      cadastro({ id: 'cfn', nip: '22222222', repsFlexaoBarra: 15, notaFlexaoBarra: '90' }),
    ];
    const sessoesCfn = [
      sessao({
        tipoProva: 'flexao_barra',
        normaTaf: 'cfn',
        resultados: [{ nip: '22222222', nome: 'Naval', tempoMs: 0, notaTexto: '90' }],
      }),
    ];
    const filtrados = filtrarCadastrosPorNorma(cadastros, 'cfn', sessoesCfn);
    expect(filtrados.map((c) => c.id)).toEqual(['cfn']);
  });
});

describe('pendenciasTafCfnHistorico', () => {
  it('montarListaPendenciasCfn: militar sem todas as provas aparece na lista', () => {
    const cadastros = [
      cadastro({
        nip: '33333333',
        notaCorrida: '80',
        tempoCorrida: '12:00',
        notaNatacao: '85',
        tempoNatacao: '02:00',
      }),
    ];
    const sessoes = [
      sessao({
        tipoProva: 'corrida',
        normaTaf: 'cfn',
        resultados: [{ nip: '33333333', nome: 'Silva', tempoMs: 720000, notaTexto: '80' }],
      }),
      sessao({
        id: 's2',
        tipoProva: 'natacao',
        normaTaf: 'cfn',
        resultados: [{ nip: '33333333', nome: 'Silva', tempoMs: 120000, notaTexto: '85' }],
      }),
    ];
    const lista = montarListaPendenciasCfn(sessoes, cadastros);
    expect(lista).toHaveLength(1);
    expect(lista[0]?.faltam.length).toBeGreaterThan(0);
    expect(lista[0]?.provas.corrida).toBe(true);
    expect(lista[0]?.provas.natacao).toBe(true);
  });
});
