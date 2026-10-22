import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  classificarSessoesAtuaisEHistoricos,
  montarBlocosPreviewSomenteAtuais,
} from '../../src/utils/resultadosAtuaisEHistoricosPreview';

const cadastroThiago: CadastroItemPersist = {
  id: 'cad-thiago',
  nip: '12.3456.78',
  nome: 'Thiago Lopes de Oliveira',
  postoGrad: 'MN',
} as CadastroItemPersist;

function sessao(
  partial: Pick<SessaoAplicacaoTaf, 'id' | 'dataAplicacao' | 'tipoProva' | 'criadoEm'> & {
    nip?: string;
    nome?: string;
    updatedAt?: number;
  },
): SessaoAplicacaoTaf {
  return {
    id: partial.id,
    criadoEm: partial.criadoEm,
    dataAplicacao: partial.dataAplicacao,
    tipoProva: partial.tipoProva,
    updatedAt: partial.updatedAt,
    resultados: [
      {
        corredor: 1,
        nome: partial.nome ?? 'Thiago Lopes de Oliveira',
        nip: partial.nip ?? '12.3456.78',
        tempoMs: 600_000,
        notaTexto: '50',
      },
    ],
  };
}

describe('classificarSessoesAtuaisEHistoricos', () => {
  it('mantém só a corrida e permanência mais recentes; antigas vão ao histórico', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'corrida-antiga',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-01-01T10:00:00.000Z',
      }),
      sessao({
        id: 'corrida-nova',
        dataAplicacao: '15/03/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-03-15T10:00:00.000Z',
      }),
      sessao({
        id: 'perm-antiga',
        dataAplicacao: '02/01/2026',
        tipoProva: 'permanencia',
        criadoEm: '2026-01-02T10:00:00.000Z',
      }),
      sessao({
        id: 'perm-nova',
        dataAplicacao: '16/03/2026',
        tipoProva: 'permanencia',
        criadoEm: '2026-03-16T10:00:00.000Z',
      }),
    ];

    const { sessoesAtuais, historicos } = classificarSessoesAtuaisEHistoricos(sessoes, [
      cadastroThiago,
    ]);

    expect(sessoesAtuais.map((s) => s.id).sort()).toEqual(['corrida-nova', 'perm-nova']);
    expect(historicos).toHaveLength(2);
    expect(historicos.map((h) => h.sessaoId).sort()).toEqual(['corrida-antiga', 'perm-antiga']);
    expect(historicos.every((h) => h.origem === 'sessao')).toBe(true);
  });

  it('agrupa mesmo militar quando uma sessão tem NIP e outra só o nome do cadastro', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'corrida-antiga',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-01-01T10:00:00.000Z',
        nip: '12.3456.78',
      }),
      sessao({
        id: 'corrida-nova',
        dataAplicacao: '15/03/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-03-15T10:00:00.000Z',
        nip: '',
        nome: 'Thiago Lopes de Oliveira',
      }),
    ];

    const { sessoesAtuais, historicos } = classificarSessoesAtuaisEHistoricos(sessoes, [
      cadastroThiago,
    ]);

    expect(sessoesAtuais.map((s) => s.id)).toEqual(['corrida-nova']);
    expect(historicos.map((h) => h.sessaoId)).toEqual(['corrida-antiga']);
  });

  it('prévia monta um bloco atual por prova recente e lista históricos', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        ...sessao({
          id: 'corrida-antiga',
          dataAplicacao: '01/01/2026',
          tipoProva: 'corrida',
          criadoEm: '2026-01-01T10:00:00.000Z',
        }),
        aplicadorAssinatura: {
          aplicadorId: 'app-1',
          nome: 'Aplicador A',
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
        },
      },
      {
        ...sessao({
          id: 'corrida-nova',
          dataAplicacao: '15/03/2026',
          tipoProva: 'corrida',
          criadoEm: '2026-03-15T10:00:00.000Z',
        }),
        aplicadorAssinatura: {
          aplicadorId: 'app-2',
          nome: 'Aplicador B',
          nip: '22.2222.22',
          categoria: 'Oficiais',
          postoGrad: 'CT',
        },
      },
    ];

    const { blocos, historicosSessao } = montarBlocosPreviewSomenteAtuais({
      sessoes,
      cadastros: [cadastroThiago],
    });

    expect(historicosSessao).toHaveLength(1);
    expect(historicosSessao[0]!.sessaoId).toBe('corrida-antiga');
    const nipsAtuais = blocos.flatMap((b) => b.linhas.map((l) => l.nip.replace(/\D/g, '')));
    expect(nipsAtuais.filter((n) => n === '12345678')).toHaveLength(1);
    expect(blocos.some((b) => b.rotuloAplicador.includes('Aplicador B'))).toBe(true);
    expect(blocos.some((b) => b.rotuloAplicador.includes('Aplicador A'))).toBe(false);
  });
});
