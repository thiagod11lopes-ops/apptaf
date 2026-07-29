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
    expect(resumo.restritos).toBe(0);
  });

  it('ignora sessões e cadastros do Modo Teste no balanço', () => {
    const cadastros = [
      cadastro({ id: 'c1', nip: '11.1111.11', nome: 'Real' }),
      cadastro({ id: 'demo-cad-0', nip: '10.0000.00', nome: 'Demo' }),
    ];
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'demo-sess-1',
        tipoProva: 'corrida',
        resultados: [
          {
            corredor: 1,
            nome: 'Demo',
            nip: '10.0000.00',
            tempoMs: 12 * 60 * 1000,
            notaTexto: '90',
            prova: 'corrida',
          },
        ],
      }),
      sessao({
        id: 's-real',
        tipoProva: 'corrida',
        resultados: [
          {
            corredor: 1,
            nome: 'Real',
            nip: '11.1111.11',
            tempoMs: 12 * 60 * 1000,
            notaTexto: '85',
            prova: 'corrida',
          },
        ],
      }),
    ];

    const resumo = calcularResumoInicioTafFromHistorico(sessoes, cadastros);
    expect(resumo.totalCadastrados).toBe(1);
    expect(resumo.parcial).toBe(1);
    expect(resumo.completos).toBe(0);
    expect(resumo.semTeste).toBe(0);
    expect(resumo.restritos).toBe(0);

    const aggs = agregarHistoricoPorParticipante(sessoes, cadastros);
    expect(aggs.every((a) => !a.nip.includes('10.0000.00'))).toBe(true);
  });

  it('move militar com dispensa ativa para restritos (fora de pendente e concluídos)', () => {
    const cadastros = [
      cadastro({ id: 'c1', nip: '11.1111.11', nome: 'Dispensado' }),
      cadastro({ id: 'c2', nip: '22.2222.22', nome: 'Pendente' }),
    ];
    const resumo = calcularResumoInicioTafFromHistorico(
      [],
      cadastros,
      [],
      new Set(['11111111']),
      new Set(),
      new Set(['11111111', '22222222']),
    );
    expect(resumo.totalCadastrados).toBe(2);
    expect(resumo.restritos).toBe(1);
    expect(resumo.semTeste).toBe(1);
    expect(resumo.completos).toBe(0);
    expect(resumo.parcial).toBe(0);
    expect(resumo.fatoresRisco).toBe(0);
    expect(resumo.cadastroIncompleto).toBe(0);
    expect(resumo.completos + resumo.parcial + resumo.semTeste + resumo.restritos).toBe(
      resumo.totalCadastrados,
    );
  });

  it('conta fatores de risco sem tirar de pendente/concluídos', () => {
    const cadastros = [
      cadastro({ id: 'c1', nip: '11.1111.11', nome: 'Com risco' }),
      cadastro({ id: 'c2', nip: '22.2222.22', nome: 'Sem risco' }),
    ];
    const resumo = calcularResumoInicioTafFromHistorico(
      [],
      cadastros,
      [],
      new Set(),
      new Set(['11111111']),
      new Set(['11111111']),
    );
    expect(resumo.fatoresRisco).toBe(1);
    expect(resumo.semTeste).toBe(2);
    expect(resumo.restritos).toBe(0);
    expect(resumo.cadastroIncompleto).toBe(1);
  });

  it('conta cadastro incompleto sem nascimento ou sem fatores preenchidos', () => {
    const cadastros = [
      cadastro({ id: 'c1', nip: '11.1111.11', dataNascimento: '' }),
      cadastro({ id: 'c2', nip: '22.2222.22', dataNascimento: '01/01/1990' }),
      cadastro({ id: 'c3', nip: '33.3333.33', dataNascimento: '02/02/1992' }),
    ];
    const resumo = calcularResumoInicioTafFromHistorico(
      [],
      cadastros,
      [],
      new Set(),
      new Set(),
      new Set(['22222222']),
    );
    expect(resumo.cadastroIncompleto).toBe(2);
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
