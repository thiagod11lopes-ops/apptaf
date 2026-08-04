import { describe, expect, it } from 'vitest';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  agruparSessoesHistoricoPorTeste,
  idsSessaoHistoricoParaExcluir,
} from '../../src/utils/agruparSessoesHistoricoPorTeste';
import { montarBlocosResumoPdfDasSessoes } from '../../src/utils/exportResumoAplicacaoPdf';

describe('agruparSessoesHistoricoPorTeste', () => {
  it('mantém um card por sessão mesmo com mesma data e tipo de prova', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-07-14T10:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'A', nip: '1', tempoMs: 1000 }],
        aplicadorAssinatura: { nome: 'App1', nip: '11.1111.11' },
      },
      {
        id: 's2',
        criadoEm: '2026-07-14T12:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'B', nip: '2', tempoMs: 2000 }],
        aplicadorAssinatura: { nome: 'App2', nip: '22.2222.22' },
      },
    ];

    const cards = agruparSessoesHistoricoPorTeste(sessoes);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.id)).toEqual(['s2', 's1']);
    expect(cards[0]!.aplicadorAssinatura?.nome).toBe('App2');
    expect(idsSessaoHistoricoParaExcluir(cards[0]!)).toEqual(['s2']);
  });

  it('PDF do dia gera um bloco por aplicação com rúbrica do próprio aplicador', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-07-14T10:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'A', nip: '1', tempoMs: 1000 }],
        aplicadorAssinatura: {
          nome: 'App1',
          nip: '11.1111.11',
          rubricaSvg: 'data:image/svg+xml,<svg/>',
        },
      },
      {
        id: 's2',
        criadoEm: '2026-07-14T11:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'B', nip: '2', tempoMs: 2000 }],
        aplicadorAssinatura: {
          nome: 'App2',
          nip: '22.2222.22',
          rubricaSvg: 'data:image/svg+xml,<svg/>',
        },
      },
    ];

    const cards = agruparSessoesHistoricoPorTeste(sessoes);
    const blocos = montarBlocosResumoPdfDasSessoes(cards);
    expect(blocos).toHaveLength(2);
    expect(blocos[0]!.aplicadorAssinatura?.nome).toBe('App1');
    expect(blocos[1]!.aplicadorAssinatura?.nome).toBe('App2');
    expect(blocos[0]!.resultados.map((r) => r.nome)).toEqual(['A']);
    expect(blocos[1]!.resultados.map((r) => r.nome)).toEqual(['B']);
  });
});
