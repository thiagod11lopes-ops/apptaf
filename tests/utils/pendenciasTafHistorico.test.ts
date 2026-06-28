import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';
import {
  cadastroComTafCompleto,
  pendenciaParcialFromCadastro,
} from '../../src/utils/resultadoTafCadastro';
import {
  calcularContagemPendencias,
  montarListaPendencias,
} from '../../src/utils/pendenciasTafHistorico';

function cadastroBase(over: Partial<CadastroItemPersist> = {}): CadastroItemPersist {
  return {
    id: 'c1',
    nip: '12.3456.78',
    nome: 'Teste Silva',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    praca: 'CB',
    ...over,
  };
}

describe('pendência corrida/caminhada substitutivas', () => {
  it('caminhada sem corrida não gera pendência de corrida', () => {
    const c = cadastroBase({
      tempoCaminhada: '38:00',
      notaCaminhada: '100',
      tempoNatacao: '02:00',
      notaNatacao: '90',
      resultadoPermanencia: 'aprovado',
    });
    expect(cadastroComTafCompleto(c)).toBe(true);
    const p = pendenciaParcialFromCadastro(c);
    expect(p.faltam).toEqual([]);
    expect(p.temCorrida).toBe(true);
  });

  it('corrida sem caminhada não exige caminhada', () => {
    const c = cadastroBase({
      tempoCorrida: '12:00',
      notaCorrida: '90',
      tempoNatacao: '02:00',
      notaNatacao: '90',
      resultadoPermanencia: 'aprovado',
    });
    expect(cadastroComTafCompleto(c)).toBe(true);
    expect(pendenciaParcialFromCadastro(c).faltam).toEqual([]);
  });

  it('montarListaPendencias: sessão caminhada conta como corrida', () => {
    const cadastros = [cadastroBase()];
    const sessoes: SessaoAplicacaoTaf[] = [
      {
        id: 's1',
        criadoEm: '2026-01-01T12:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'caminhada',
        resultados: [
          {
            corredor: 1,
            nome: 'Teste Silva',
            nip: '12.3456.78',
            tempoMs: 38 * 60 * 1000,
            notaTexto: '100',
            prova: 'caminhada',
          },
        ],
      },
    ];
    const contagem = calcularContagemPendencias(sessoes, cadastros);
    expect(contagem.corrida).toBe(0);
    const lista = montarListaPendencias(sessoes, cadastros);
    expect(lista[0]?.faltam).not.toContain('Corrida');
  });
});
