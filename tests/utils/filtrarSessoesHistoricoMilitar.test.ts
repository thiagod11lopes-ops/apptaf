import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import { filtrarSessoesHistoricoMilitar } from '../../src/utils/filtrarSessoesHistoricoMilitar';

const cadastro: CadastroItemPersist = {
  id: 'c1',
  nip: '12.3456.78',
  nome: 'Silva Teste',
  dataNascimento: '01/01/1990',
  categoria: 'Praças',
  praca: 'CB',
};

describe('filtrarSessoesHistoricoMilitar', () => {
  it('retorna sessões em que o militar participou', () => {
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-01-01T10:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida',
        resultados: [{ corredor: 1, nome: 'Silva Teste', nip: '12.3456.78', tempoMs: 600000 }],
      },
      {
        id: 's2',
        criadoEm: '2026-01-02T10:00:00.000Z',
        dataAplicacao: '02/01/2026',
        tipoProva: 'natacao',
        resultados: [{ corredor: 1, nome: 'Outro', nip: '99.9999.99', tempoMs: 120000 }],
      },
    ];

    const filtradas = filtrarSessoesHistoricoMilitar(
      sessoes,
      { id: 'c1', nip: '12.3456.78', nome: 'Silva Teste' },
      [cadastro],
    );

    expect(filtradas).toHaveLength(1);
    expect(filtradas[0]?.id).toBe('s1');
  });
});
