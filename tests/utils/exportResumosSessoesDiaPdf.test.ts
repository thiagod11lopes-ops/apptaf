import { describe, expect, it } from 'vitest';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  montarBlocosResumoPdfDasSessoes,
  nomeArquivoPdfResultadosDoDia,
} from '../../src/utils/exportResumoAplicacaoPdf';

describe('exportResumosSessoesDiaPdf helpers', () => {
  it('nomeArquivoPdfResultadosDoDia usa a data do dia', () => {
    expect(nomeArquivoPdfResultadosDoDia('14/07/2026')).toBe('Resultados_do_dia_14-07-2026.pdf');
  });

  it('montarBlocosResumoPdfDasSessoes ordena por criadoEm e preenche prova', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's2',
        criadoEm: '2026-07-14T12:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'natacao',
        resultados: [{ corredor: 1, nome: 'B', nip: '2', tempoMs: 1000 }],
        aplicadorAssinatura: { nome: 'App2', nip: '22.2222.22' },
      },
      {
        id: 's1',
        criadoEm: '2026-07-14T10:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'A', nip: '1', tempoMs: 2000 }],
        aplicadorAssinatura: { nome: 'App1', nip: '11.1111.11' },
      },
      {
        id: 's3',
        criadoEm: '2026-07-14T13:00:00.000Z',
        dataAplicacao: '14/07/2026',
        tipoProva: 'corrida',
        resultados: [],
      },
    ];

    const blocos = montarBlocosResumoPdfDasSessoes(sessoes);
    expect(blocos).toHaveLength(2);
    expect(blocos[0]!.resultados[0]!.nome).toBe('A');
    expect(blocos[0]!.resultados[0]!.prova).toBe('corrida');
    expect(blocos[0]!.aplicadorAssinatura?.nome).toBe('App1');
    expect(blocos[1]!.resultados[0]!.prova).toBe('natacao');
  });
});
