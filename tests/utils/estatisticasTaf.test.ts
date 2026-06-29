import { describe, expect, it } from 'vitest';
import { calcularEstatisticasTaf } from '../../src/utils/estatisticasTaf';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';

const base: CadastroItemPersist = {
  id: '1',
  nip: '12.3456.78',
  nome: 'Silva',
  dataNascimento: '01/01/1990',
  categoria: 'Praças',
  sexo: 'M',
  praca: 'CB',
};

describe('calcularEstatisticasTaf', () => {
  it('calcula média de militares únicos por dia de aplicação', () => {
    const cadastros: CadastroItemPersist[] = [
      {
        ...base,
        id: '1',
        dataTafCorrida: '10/06/2026',
        tempoCorrida: '12:00',
        notaCorrida: '90',
      },
      {
        ...base,
        id: '2',
        nip: '98.7654.32',
        nome: 'Santos',
        dataTafCorrida: '10/06/2026',
        tempoCorrida: '13:00',
        notaCorrida: '80',
      },
      {
        ...base,
        id: '3',
        nip: '11.2222.33',
        nome: 'Costa',
        dataTafNatacao: '11/06/2026',
        tempoNatacao: '01:00',
        notaNatacao: '90',
      },
    ];

    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '',
        dataAplicacao: '12/06/2026',
        tipoProva: 'permanencia',
        resultados: [{ nip: '12.3456.78', nomeMilitar: 'Silva', notaTexto: 'APROVADO' }],
      },
    ];

    const s = calcularEstatisticasTaf(cadastros, sessoes);
    expect(s.resumo.diasComAplicacao).toBe(3);
    expect(s.resumo.mediaMilitaresPorDia).toBe(1.3);
    expect(s.resumo.tafCompleto).toBe(0);
    expect(s.resumo.comCaminhada).toBe(0);
  });

  it('conta TAF completo e caminhada', () => {
    const c: CadastroItemPersist = {
      ...base,
      tempoCaminhada: '40:00',
      notaCaminhada: '90',
      dataTafCaminhada: '01/06/2026',
      tempoNatacao: '01:00',
      notaNatacao: '90',
      dataTafNatacao: '02/06/2026',
      resultadoPermanencia: 'aprovado',
      dataTafPermanencia: '03/06/2026',
    };
    const s = calcularEstatisticasTaf([c], []);
    expect(s.resumo.tafCompleto).toBe(1);
    expect(s.resumo.comCaminhada).toBe(1);
    expect(s.resumo.comCorrida).toBe(0);
  });
});
