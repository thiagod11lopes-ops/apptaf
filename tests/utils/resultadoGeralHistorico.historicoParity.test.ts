import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import { prepararDadosResultadosNorma } from '../../src/utils/normaTafResultados';
import { listarResultadosGeralFromHistorico } from '../../src/utils/resultadoGeralHistorico';
import { unificarSessoesComCadastroRegistrador } from '../../src/utils/sessoesUnificadasResultados';
import { nipDigitos } from '../../src/utils/nipFormat';

function sessao(
  partial: Partial<SessaoAplicacaoTaf> & Pick<SessaoAplicacaoTaf, 'id' | 'tipoProva'>,
): SessaoAplicacaoTaf {
  return {
    id: partial.id,
    criadoEm: partial.criadoEm ?? '2026-03-10T12:00:00.000Z',
    dataAplicacao: partial.dataAplicacao ?? '10/03/2026',
    tipoProva: partial.tipoProva,
    resultados: partial.resultados ?? [],
    normaTaf: partial.normaTaf,
    aplicadorAssinatura: partial.aplicadorAssinatura,
  };
}

function cadastro(partial: Partial<CadastroItemPersist>): CadastroItemPersist {
  return {
    id: partial.id ?? 'cad-1',
    nip: partial.nip ?? '12345678',
    nome: partial.nome ?? 'Silva',
    dataNascimento: partial.dataNascimento ?? '01/01/1990',
    categoria: partial.categoria ?? 'Praças',
    praca: partial.praca ?? 'CB',
    ...partial,
  };
}

describe('Histórico → Gerenciar resultados', () => {
  it('lista no Geral o militar presente na sessão do Histórico (busca por NIP/nome)', () => {
    const cadastros = [
      cadastro({
        id: 'cad-ana',
        nip: '87654321',
        nome: 'Ana Souza',
        notaCorrida: '85',
        tempoCorrida: '11:30',
        dataTafCorrida: '10/03/2026',
      }),
    ];
    const sessoesRaw: SessaoAplicacaoTaf[] = [
      sessao({
        id: 'sessao-corrida-1',
        tipoProva: 'corrida',
        normaTaf: 'armada',
        resultados: [
          {
            corredor: 1,
            nip: '87.654.321',
            nome: 'Ana Souza',
            tempoMs: 690_000,
            notaTexto: '85',
            prova: 'corrida',
          },
        ],
      }),
    ];

    const unificadas = unificarSessoesComCadastroRegistrador(sessoesRaw, cadastros);
    const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
      unificadas,
      cadastros,
      'armada',
      { jaUnificadas: true },
    );
    const lista = listarResultadosGeralFromHistorico(sessoesNorma, cadastrosNorma, {
      jaUnificadas: true,
    });

    const q = 'ana';
    const qDigits = '87654321';
    const achados = lista.filter((item) => {
      const hay = `${item.nip} ${item.nome}`.toLowerCase();
      return hay.includes(q) || nipDigitos(item.nip).includes(qDigits);
    });

    expect(achados).toHaveLength(1);
    expect(nipDigitos(achados[0]!.nip)).toBe('87654321');
    expect(achados[0]!.notaCorrida).toBe('85');
  });

  it('sessão virtual de grupo persistida indevidamente entra no Geral após unificar', () => {
    const cadastros = [
      cadastro({
        id: 'cad-bruno',
        nip: '11223344',
        nome: 'Bruno Lima',
      }),
    ];
    const legado = sessao({
      id: 'registrador-corrida:10/03/2026',
      tipoProva: 'corrida',
      resultados: [
        {
          corredor: 1,
          nip: '11223344',
          nome: 'Bruno Lima',
          tempoMs: 720_000,
          notaTexto: '80',
          prova: 'corrida',
        },
      ],
    });

    const unificadas = unificarSessoesComCadastroRegistrador([legado], cadastros);
    expect(unificadas.some((s) => s.id === 'registrador-corrida:10/03/2026')).toBe(true);

    const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
      unificadas,
      cadastros,
      'armada',
      { jaUnificadas: true },
    );
    const lista = listarResultadosGeralFromHistorico(sessoesNorma, cadastrosNorma, {
      jaUnificadas: true,
    });

    expect(lista.some((l) => nipDigitos(l.nip) === '11223344')).toBe(true);
    expect(lista.find((l) => nipDigitos(l.nip) === '11223344')?.notaCorrida).toBe('80');
  });
});
