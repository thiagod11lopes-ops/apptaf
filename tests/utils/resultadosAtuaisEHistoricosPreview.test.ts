import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import { buildResultadosTafHtml } from '../../src/utils/exportResultadosTafPdf';
import {
  classificarSessoesAtuaisEHistoricos,
  montarBlocosPreviewSomenteAtuais,
} from '../../src/utils/resultadosAtuaisEHistoricosPreview';

const cadastroThiago: CadastroItemPersist = {
  id: 'cad-thiago',
  nip: '06.0380.85',
  nome: 'THIAGO LOPES DE OLIVEIRA',
  postoGrad: '1°SG',
  notaCorrida: '50',
  tempoCorrida: '16:10:00',
  notaNatacao: '50',
  tempoNatacao: '01:26:00',
  resultadoPermanencia: 'aprovado',
  tempoPermanencia: '10:00',
} as CadastroItemPersist;

function sessao(
  partial: Pick<SessaoAplicacaoTaf, 'id' | 'dataAplicacao' | 'tipoProva' | 'criadoEm'> & {
    nip?: string;
    nome?: string;
    notaTexto?: string;
    tempoMs?: number;
    desempenhoTexto?: string;
    aplicadorId?: string;
    aplicadorNome?: string;
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
        nome: partial.nome ?? 'THIAGO LOPES DE OLIVEIRA',
        nip: partial.nip ?? '06.0380.85',
        tempoMs: partial.tempoMs ?? 600_000,
        notaTexto: partial.notaTexto ?? '50',
        desempenhoTexto: partial.desempenhoTexto,
      },
    ],
    aplicadorAssinatura: partial.aplicadorId
      ? {
          aplicadorId: partial.aplicadorId,
          nome: partial.aplicadorNome ?? partial.aplicadorId,
          nip: '11.1111.11',
          categoria: 'Oficiais',
          postoGrad: 'CT',
          rubricaSvg: `data:image/svg+xml,<svg id="${partial.aplicadorId}"/>`,
        }
      : undefined,
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
  });

  it('agrupa mesmo militar quando uma sessão tem NIP e outra só o nome do cadastro', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'corrida-antiga',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-01-01T10:00:00.000Z',
        nip: '06.0380.85',
      }),
      sessao({
        id: 'corrida-nova',
        dataAplicacao: '15/03/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-03-15T10:00:00.000Z',
        nip: '',
        nome: 'THIAGO LOPES DE OLIVEIRA',
      }),
    ];

    const { sessoesAtuais, historicos } = classificarSessoesAtuaisEHistoricos(sessoes, [
      cadastroThiago,
    ]);

    expect(sessoesAtuais.map((s) => s.id)).toEqual(['corrida-nova']);
    expect(historicos.map((h) => h.sessaoId)).toEqual(['corrida-antiga']);
  });
});

describe('montarBlocosPreviewSomenteAtuais', () => {
  it('não repete corrida/permanência no bloco de outro aplicador via cadastro', () => {
    // Diogo: corrida (mais nova) + natação + permanência (mais nova)
    // Wanderson: corrida antiga + permanência antiga → histórico
    // Cadastro ainda tem as notas atuais — não pode vazar para o bloco do Wanderson.
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'wand-corrida',
        dataAplicacao: '13/08/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-08-13T10:00:00.000Z',
        notaTexto: '60',
        desempenhoTexto: '15:02:00',
        aplicadorId: 'wanderson',
        aplicadorNome: 'Wanderson Teixeira Nogueira',
      }),
      sessao({
        id: 'wand-perm',
        dataAplicacao: '13/08/2026',
        tipoProva: 'permanencia',
        criadoEm: '2026-08-13T10:05:00.000Z',
        aplicadorId: 'wanderson',
        aplicadorNome: 'Wanderson Teixeira Nogueira',
      }),
      sessao({
        id: 'diogo-corrida',
        dataAplicacao: '20/09/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-09-20T10:00:00.000Z',
        notaTexto: '50',
        desempenhoTexto: '16:10:00',
        aplicadorId: 'diogo',
        aplicadorNome: 'Diogo Silva Gama',
      }),
      sessao({
        id: 'diogo-natacao',
        dataAplicacao: '20/09/2026',
        tipoProva: 'natacao',
        criadoEm: '2026-09-20T10:10:00.000Z',
        notaTexto: '50',
        desempenhoTexto: '01:26:00',
        tempoMs: 86_000,
        aplicadorId: 'diogo',
        aplicadorNome: 'Diogo Silva Gama',
      }),
      sessao({
        id: 'diogo-perm',
        dataAplicacao: '20/09/2026',
        tipoProva: 'permanencia',
        criadoEm: '2026-09-20T10:20:00.000Z',
        aplicadorId: 'diogo',
        aplicadorNome: 'Diogo Silva Gama',
      }),
    ];

    const { blocos, historicosSessao } = montarBlocosPreviewSomenteAtuais({
      sessoes,
      cadastros: [cadastroThiago],
    });

    expect(historicosSessao.map((h) => h.sessaoId).sort()).toEqual(['wand-corrida', 'wand-perm']);

    const blocoDiogo = blocos.find((b) => b.rotuloAplicador.includes('Diogo'));
    const blocoWand = blocos.find((b) => b.rotuloAplicador.includes('Wanderson'));

    expect(blocoDiogo).toBeTruthy();
    expect(blocoWand).toBeFalsy(); // sem sessões atuais → sem bloco

    const linha = blocoDiogo!.linhas.find((l) => l.nip.replace(/\D/g, '') === '06038085');
    expect(linha).toBeTruthy();
    expect(linha!.notaCorrida).toBe('50');
    expect(linha!.notaNatacao).toBe('50');
    expect(linha!.situacaoPermanencia).toBe('Aprovado');
  });

  it('PDF inclui a corrida atual do Wanderson (não só natação/permanência do Diogo)', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'diogo-natacao',
        dataAplicacao: '20/09/2026',
        tipoProva: 'natacao',
        criadoEm: '2026-09-20T10:10:00.000Z',
        notaTexto: '50',
        desempenhoTexto: '01:26:00',
        tempoMs: 86_000,
        aplicadorId: 'diogo',
        aplicadorNome: 'Diogo Silva Gama',
      }),
      sessao({
        id: 'diogo-perm',
        dataAplicacao: '20/09/2026',
        tipoProva: 'permanencia',
        criadoEm: '2026-09-20T10:20:00.000Z',
        aplicadorId: 'diogo',
        aplicadorNome: 'Diogo Silva Gama',
      }),
      sessao({
        id: 'wand-corrida',
        dataAplicacao: '20/09/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-09-20T09:00:00.000Z',
        notaTexto: '50',
        desempenhoTexto: '16:10:00',
        aplicadorId: 'wanderson',
        aplicadorNome: 'Wanderson Teixeira Nogueira',
      }),
    ];

    const { blocos, historicosSessao } = montarBlocosPreviewSomenteAtuais({
      sessoes,
      cadastros: [cadastroThiago],
    });
    expect(historicosSessao).toHaveLength(0);
    expect(blocos).toHaveLength(2);

    const html = buildResultadosTafHtml(blocos, 'teste NIP 06038085');
    expect(html).toContain('Wanderson');
    expect(html).toContain('Diogo');
    expect(html).toContain('Nota corrida');
    expect(html).toMatch(/>50</);
    expect(html).toContain('16:10:00');
  });

  it('quando Wanderson tem só permanência atual, não herda corrida do cadastro', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'diogo-corrida',
        dataAplicacao: '20/09/2026',
        tipoProva: 'corrida',
        criadoEm: '2026-09-20T10:00:00.000Z',
        aplicadorId: 'diogo',
        aplicadorNome: 'Diogo Silva Gama',
      }),
      sessao({
        id: 'wand-perm',
        dataAplicacao: '21/09/2026',
        tipoProva: 'permanencia',
        criadoEm: '2026-09-21T10:00:00.000Z',
        aplicadorId: 'wanderson',
        aplicadorNome: 'Wanderson Teixeira Nogueira',
      }),
    ];

    const { blocos, historicosSessao } = montarBlocosPreviewSomenteAtuais({
      sessoes,
      cadastros: [cadastroThiago],
    });

    expect(historicosSessao).toHaveLength(0);

    const blocoDiogo = blocos.find((b) => b.rotuloAplicador.includes('Diogo'))!;
    const blocoWand = blocos.find((b) => b.rotuloAplicador.includes('Wanderson'))!;
    const linhaDiogo = blocoDiogo.linhas[0]!;
    const linhaWand = blocoWand.linhas[0]!;

    expect(linhaDiogo.notaCorrida).toBe('50');
    expect(linhaDiogo.situacaoPermanencia === '—' || !linhaDiogo.situacaoPermanencia).toBe(true);

    expect(linhaWand.situacaoPermanencia).toBe('Aprovado');
    expect(linhaWand.notaCorrida === '—' || !linhaWand.notaCorrida).toBe(true);
  });
});
