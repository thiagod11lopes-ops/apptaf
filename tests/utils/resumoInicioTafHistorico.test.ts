import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  agregarHistoricoPorParticipante,
  calcularResumoInicioTafFromHistorico,
} from '../../src/utils/resultadoGeralHistorico';

function cadastro(over: Partial<CadastroItemPersist> = {}): CadastroItemPersist {
  return {
    id: 'cad-1',
    nip: '12.3456.78',
    nome: 'Alpha',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    praca: 'CB',
    ...over,
  };
}

function sessao(
  partial: Partial<SessaoAplicacaoTaf> &
    Pick<SessaoAplicacaoTaf, 'id' | 'tipoProva' | 'resultados'>,
): SessaoAplicacaoTaf {
  return {
    criadoEm: '2026-01-01T12:00:00.000Z',
    dataAplicacao: '01/01/2026',
    ...partial,
  };
}

describe('calcularResumoInicioTafFromHistorico', () => {
  it('não infla Parcial com sessão de NIP sem cadastro (Pendente permanece estável)', () => {
    const cadastros = [
      cadastro({ id: 'c1', nip: '11.1111.11', nome: 'Um' }),
      cadastro({ id: 'c2', nip: '22.2222.22', nome: 'Dois' }),
    ];
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 's-cad',
        tipoProva: 'corrida',
        resultados: [
          {
            corredor: 1,
            nome: 'Um',
            nip: '11.1111.11',
            tempoMs: 12 * 60 * 1000,
            notaTexto: '90',
            prova: 'corrida',
          },
        ],
      }),
      sessao({
        id: 's-orfao',
        tipoProva: 'natacao',
        resultados: [
          {
            corredor: 1,
            nome: 'Orfao',
            nip: '99.9999.99',
            tempoMs: 2 * 60 * 1000,
            notaTexto: '80',
            prova: 'natacao',
          },
        ],
      }),
    ];

    const resumo = calcularResumoInicioTafFromHistorico(sessoes, cadastros);
    expect(resumo.totalCadastrados).toBe(2);
    expect(resumo.parcial).toBe(1);
    expect(resumo.completos).toBe(0);
    expect(resumo.semTeste).toBe(1);
    expect(resumo.completos + resumo.parcial + resumo.semTeste).toBe(resumo.totalCadastrados);
  });

  it('une o mesmo NIP vindo com chaves diferentes em um único participante', () => {
    const cadastros = [cadastro()];
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 's1',
        tipoProva: 'corrida',
        criadoEm: '2026-01-01T10:00:00.000Z',
        resultados: [
          {
            corredor: 1,
            nome: 'Alpha',
            nip: '12345678',
            tempoMs: 12 * 60 * 1000,
            notaTexto: '90',
            prova: 'corrida',
          },
        ],
      }),
      sessao({
        id: 's2',
        tipoProva: 'natacao',
        criadoEm: '2026-01-02T10:00:00.000Z',
        resultados: [
          {
            corredor: 1,
            nome: 'Alpha',
            nip: '12.3456.78',
            tempoMs: 2 * 60 * 1000,
            notaTexto: '85',
            prova: 'natacao',
          },
        ],
      }),
    ];

    const aggs = agregarHistoricoPorParticipante(sessoes, cadastros);
    expect(aggs).toHaveLength(1);
    expect(aggs[0]?.corrida).toBeTruthy();
    expect(aggs[0]?.natacao).toBeTruthy();

    const resumo = calcularResumoInicioTafFromHistorico(sessoes, cadastros);
    expect(resumo.parcial).toBe(1);
    expect(resumo.completos).toBe(0);
    expect(resumo.semTeste).toBe(0);
  });
});
