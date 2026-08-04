import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  cadastroComTafCompleto,
  pendenciaParcialFromCadastro,
} from '../../src/utils/resultadoTafCadastro';
import {
  calcularContagemPendencias,
  filtrarPendenciasParciais,
  filtrarPendenciasTotais,
  montarListaConcluidos,
  montarListaPendencias,
  montarListaPendenciasTotais,
} from '../../src/utils/pendenciasTafHistorico';
import { listarResultadosGeralFromHistorico } from '../../src/utils/resultadoGeralHistorico';

function cadastroBase(over: Partial<CadastroItemPersist> = {}): CadastroItemPersist {
  return {
    id: 'c1',
    nip: '12.3456.78',
    nome: 'Teste Silva',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    praca: 'CB',
    ...over,
  };
}

describe('pendência corrida/caminhada substitutivas', () => {
  it('caminhada sem corrida não gera pendência de corrida', () => {
    const c = cadastroBase({
      tempoCaminhada: '38:00',
      notaCaminhada: '100',
      tempoNatacao: '02:00',
      notaNatacao: '90',
      resultadoPermanencia: 'aprovado',
    });
    expect(cadastroComTafCompleto(c)).toBe(true);
    const p = pendenciaParcialFromCadastro(c);
    expect(p.faltam).toEqual([]);
    expect(p.temCorrida).toBe(true);
  });

  it('corrida sem caminhada não exige caminhada', () => {
    const c = cadastroBase({
      tempoCorrida: '12:00',
      notaCorrida: '90',
      tempoNatacao: '02:00',
      notaNatacao: '90',
      resultadoPermanencia: 'aprovado',
    });
    expect(cadastroComTafCompleto(c)).toBe(true);
    expect(pendenciaParcialFromCadastro(c).faltam).toEqual([]);
  });

  it('montarListaPendencias: sessão caminhada conta como corrida', () => {
    const cadastros = [cadastroBase()];
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-01-01T12:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'caminhada',
        resultados: [
          {
            corredor: 1,
            nome: 'Teste Silva',
            nip: '12.3456.78',
            tempoMs: 38 * 60 * 1000,
            notaTexto: '100',
            prova: 'caminhada',
          },
        ],
      },
    ];
    const contagem = calcularContagemPendencias(sessoes, cadastros);
    expect(contagem.corrida).toBe(0);
    const lista = montarListaPendencias(sessoes, cadastros);
    expect(lista[0]?.faltam).not.toContain('Corrida');
  });

  it('listarResultadosGeralFromHistorico: caminhada fica na coluna própria, não em corrida', () => {
    const cadastros = [cadastroBase()];
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-01-01T12:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'caminhada',
        resultados: [
          {
            corredor: 1,
            nome: 'Teste Silva',
            nip: '12.3456.78',
            tempoMs: 38 * 60 * 1000,
            notaTexto: '100',
            prova: 'caminhada',
          },
        ],
      },
    ];
    const linhas = listarResultadosGeralFromHistorico(sessoes, cadastros);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.notaCaminhada).toBe('100');
    expect(linhas[0]?.notaCorrida).toBe('—');
    expect(linhas[0]?.situacaoCaminhada).toBe('Aprovado');
    expect(linhas[0]?.situacaoCorrida).toBe('—');
  });

  it('montarListaConcluidos: militar com três modalidades aparece na lista', () => {
    const cadastros = [
      cadastroBase({
        tempoCorrida: '12:00',
        notaCorrida: '90',
        tempoNatacao: '02:00',
        notaNatacao: '90',
        resultadoPermanencia: 'aprovado',
      }),
    ];
    const concluidos = montarListaConcluidos([], cadastros);
    expect(concluidos).toHaveLength(1);
    expect(concluidos[0]?.nome).toBe('Teste Silva');
  });

  it('separa pendência parcial (com testes) da total (sem nenhum teste)', () => {
    const cadastros = [
      cadastroBase({ id: 'c1', nip: '12.3456.01', nome: 'Parcial Silva' }),
      cadastroBase({ id: 'c2', nip: '12.3456.02', nome: 'Sem Teste' }),
    ];
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-01-01T12:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        resultados: [
          {
            corredor: 1,
            nome: 'Parcial Silva',
            nip: '12.3456.01',
            tempoMs: 12 * 60 * 1000,
            notaTexto: '90',
            prova: 'corrida',
          },
        ],
      },
    ];
    const lista = montarListaPendencias(sessoes, cadastros);
    expect(filtrarPendenciasParciais(lista).map((p) => p.nome)).toEqual(['Parcial Silva']);
    expect(filtrarPendenciasTotais(lista).map((p) => p.nome)).toEqual(['Sem Teste']);
  });

  it('montarListaPendenciasTotais inclui cadastros sem nenhum teste (base completa)', () => {
    const muitosSemTeste = Array.from({ length: 5 }, (_, i) =>
      cadastroBase({
        id: `sem-${i}`,
        nip: `12.3456.${String(10 + i).padStart(2, '0')}`,
        nome: `Sem Teste ${i}`,
      }),
    );
    const cadastros = [
      cadastroBase({ id: 'c1', nip: '12.3456.01', nome: 'Com Teste' }),
      ...muitosSemTeste,
    ];
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-01-01T12:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        resultados: [
          {
            corredor: 1,
            nome: 'Com Teste',
            nip: '12.3456.01',
            tempoMs: 12 * 60 * 1000,
            notaTexto: '90',
            prova: 'corrida',
          },
        ],
      },
    ];
    const total = montarListaPendenciasTotais(sessoes, cadastros);
    expect(total).toHaveLength(5);
    expect(total.every((p) => p.situacao === 'Sem teste')).toBe(true);
    expect(total.some((p) => p.nome === 'Com Teste')).toBe(false);
  });
});
