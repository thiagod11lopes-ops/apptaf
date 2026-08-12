import { describe, expect, it } from 'vitest';
import { montarListaReprovadosInicioTaf } from '../../src/utils/resultadoGeralHistorico';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';

describe('montarListaReprovadosInicioTaf', () => {
  it('lista cadastrado reprovado na corrida com tempo mínimo da nota 50', () => {
    const cadastros: CadastroItemPersist[] = [
      {
        id: 'c1',
        nip: '12.3456.78',
        nome: 'SILVA JOAO',
        dataNascimento: '01/01/1990',
        categoria: 'Praças',
        praca: 'MN',
        sexo: 'M',
        notaCorrida: 'REPROVADO',
        tempoCorrida: '12:34',
        dataTafCorrida: '15/03/2026',
      },
      {
        id: 'c2',
        nip: '87.6543.21',
        nome: 'SOUZA PEDRO',
        dataNascimento: '02/02/1991',
        categoria: 'Praças',
        praca: 'CB',
        notaCorrida: '100',
      },
    ];
    const lista = montarListaReprovadosInicioTaf([], cadastros, []);
    expect(lista).toHaveLength(1);
    expect(lista[0]?.nome).toBe('SILVA JOAO');
    const corrida = lista[0]?.modalidades.find((m) => m.label === 'Corrida');
    expect(corrida?.data).toBe('15/03/2026');
    expect(corrida?.tempo).toMatch(/^12:34/);
    // Homem ~36 anos (faixa 34–39): limite nota 50 = 15:30
    expect(corrida?.tempoMinimo).toBe('15:30');
  });

  it('lista reprovado via sessão com tempo e mínimo de natação', () => {
    const cadastros: CadastroItemPersist[] = [
      {
        id: 'c3',
        nip: '11.1111.11',
        nome: 'ALMEIDA ANA',
        dataNascimento: '03/03/1992',
        categoria: 'Oficiais',
        oficial: '1T',
        sexo: 'F',
      },
    ];
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: new Date().toISOString(),
        dataAplicacao: '20/04/2026',
        tipoProva: 'natacao',
        resultados: [
          {
            corredor: 1,
            nome: 'ALMEIDA ANA',
            nip: '11.1111.11',
            tempoMs: 95_450,
            notaTexto: 'REPROVADO',
            reprovacaoTexto: 'Reprovado',
          },
        ],
      },
    ];
    const lista = montarListaReprovadosInicioTaf(sessoes, cadastros, []);
    expect(lista).toHaveLength(1);
    const natacao = lista[0]?.modalidades.find((m) => m.label === 'Natação');
    expect(natacao?.data).toBe('20/04/2026');
    expect(natacao?.tempo).toBe('01:35:45');
    // Mulher ~34 anos (faixa 31–40): limite nota 50 = 02:25
    expect(natacao?.tempoMinimo).toBe('02:25');
  });
});
