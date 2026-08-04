import { describe, expect, it } from 'vitest';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  agruparSessoesHistoricoPorTeste,
  idsSessaoHistoricoParaExcluir,
} from '../../src/utils/agruparSessoesHistoricoPorTeste';
import { montarBlocosResumoPdfDasSessoes } from '../../src/utils/exportResumoAplicacaoPdf';

const rubricaA = 'data:image/svg+xml,<svg id="a"><path d="M1 1 L2 2"/></svg>';
const rubricaB = 'data:image/svg+xml,<svg id="b"><path d="M3 3 L4 4"/></svg>';

describe('agruparSessoesHistoricoPorTeste', () => {
  it('funde militares da mesma rúbrica do aplicador em um único card', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 'registrador-c1-corrida',
        criadoEm: '2026-07-14T10:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'Militar A', nip: '12.3456.01', tempoMs: 1000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'Aplicador',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaA,
        },
      },
      {
        id: 'registrador-c2-corrida',
        criadoEm: '2026-07-14T10:00:01.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'Militar B', nip: '12.3456.02', tempoMs: 2000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'Aplicador',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaA,
        },
      },
      {
        id: 'registrador-c3-corrida',
        criadoEm: '2026-07-14T10:00:02.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'Militar C', nip: '12.3456.03', tempoMs: 3000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'Aplicador',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaA,
        },
      },
    ];

    const cards = agruparSessoesHistoricoPorTeste(sessoes);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.resultados.map((r) => r.nome).sort()).toEqual([
      'Militar A',
      'Militar B',
      'Militar C',
    ]);
    expect(cards[0]!.aplicadorAssinatura?.rubricaSvg).toBe(rubricaA);
    expect(idsSessaoHistoricoParaExcluir(cards[0]!)).toHaveLength(3);
  });

  it('mantém dois cards quando há duas rúbricas (duas aplicações) no mesmo dia', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-07-14T10:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'A', nip: '12.3456.01', tempoMs: 1000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'App1',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaA,
        },
      },
      {
        id: 's2',
        criadoEm: '2026-07-14T12:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'B', nip: '12.3456.02', tempoMs: 2000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'App1',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaB,
        },
      },
    ];

    const cards = agruparSessoesHistoricoPorTeste(sessoes);
    expect(cards).toHaveLength(2);
  });

  it('omite sessões sem rúbrica já cobertas pela aplicação assinada', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 'sessao-oficial',
        criadoEm: '2026-07-14T10:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [
          { corredor: 1, nome: 'A', nip: '12.3456.01', tempoMs: 1000 },
          { corredor: 2, nome: 'B', nip: '12.3456.02', tempoMs: 2000 },
        ],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'App1',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaA,
        },
      },
      {
        id: 'registrador-c1-corrida',
        criadoEm: '2026-07-14T10:01:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'A', nip: '12.3456.01', tempoMs: 1000 }],
      },
      {
        id: 'registrador-c2-corrida',
        criadoEm: '2026-07-14T10:02:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'B', nip: '12.3456.02', tempoMs: 2000 }],
      },
    ];

    const cards = agruparSessoesHistoricoPorTeste(sessoes);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.id).toBe('sessao-oficial');
  });

  it('PDF do dia gera um bloco por aplicação assinada', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1a',
        criadoEm: '2026-07-14T10:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'A', nip: '12.3456.01', tempoMs: 1000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'App1',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaA,
        },
      },
      {
        id: 's1b',
        criadoEm: '2026-07-14T10:00:01.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'B', nip: '12.3456.02', tempoMs: 2000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'App1',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaA,
        },
      },
      {
        id: 's2',
        criadoEm: '2026-07-14T11:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'C', nip: '12.3456.03', tempoMs: 3000 }],
        aplicadorAssinatura: {
          aplicadorId: 'app-2',
          nome: 'App2',
          nip: '22.2222.22',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: rubricaB,
        },
      },
    ];

    const cards = agruparSessoesHistoricoPorTeste(sessoes);
    const blocos = montarBlocosResumoPdfDasSessoes(cards);
    expect(cards).toHaveLength(2);
    expect(blocos).toHaveLength(2);
    const nomes = blocos.map((b) => b.resultados.map((r) => r.nome).sort());
    expect(nomes).toContainEqual(['A', 'B']);
    expect(nomes).toContainEqual(['C']);
  });
});
