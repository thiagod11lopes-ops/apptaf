import { describe, expect, it } from 'vitest';
import { montarListaReprovadosInicioTaf } from '../../src/utils/resultadoGeralHistorico';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';

describe('montarListaReprovadosInicioTaf', () => {
  it('lista cadastrado reprovado na corrida', () => {
    const cadastros: CadastroItemPersist[] = [
      {
        id: 'c1',
        nip: '12.3456.78',
        nome: 'SILVA JOAO',
        dataNascimento: '01/01/1990',
        categoria: 'Praças',
        praca: 'MN',
        notaCorrida: 'REPROVADO',
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
    expect(lista[0]?.modalidades.some((m) => m.label === 'Corrida')).toBe(true);
    expect(lista[0]?.modalidades.find((m) => m.label === 'Corrida')?.data).toBe('15/03/2026');
  });

  it('lista reprovado via sessão', () => {
    const cadastros: CadastroItemPersist[] = [
      {
        id: 'c3',
        nip: '11.1111.11',
        nome: 'ALMEIDA ANA',
        dataNascimento: '03/03/1992',
        categoria: 'Oficiais',
        oficial: '1T',
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
            tempoMs: 0,
            notaTexto: 'REPROVADO',
            reprovacaoTexto: 'Reprovado',
          },
        ],
      },
    ];
    const lista = montarListaReprovadosInicioTaf(sessoes, cadastros, []);
    expect(lista).toHaveLength(1);
    expect(lista[0]?.modalidades.some((m) => m.label === 'Natação')).toBe(true);
    expect(lista[0]?.modalidades.find((m) => m.label === 'Natação')?.data).toBe('20/04/2026');
  });
});
