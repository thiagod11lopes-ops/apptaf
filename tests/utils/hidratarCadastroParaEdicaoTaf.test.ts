import { describe, expect, it } from 'vitest';
import { tempoParaEdicaoMmSs, tempoParaExibicao } from '../../src/utils/formatMinutosSegundos';
import {
  hidratarCadastroParaEdicaoTaf,
  sementesEdicaoFromLinhaResultado,
} from '../../src/utils/hidratarCadastroParaEdicaoTaf';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';

describe('tempoParaEdicaoMmSs', () => {
  it('converte MM:SS:CS do Aplicar TAF para MM:SS', () => {
    expect(tempoParaEdicaoMmSs('12:34:56')).toBe('12:34');
    expect(tempoParaExibicao('05:03:00')).toBe('05:03');
  });

  it('mantém MM:SS e normaliza minuto único', () => {
    expect(tempoParaEdicaoMmSs('3:05')).toBe('03:05');
    expect(tempoParaEdicaoMmSs('12:34')).toBe('12:34');
  });
});

describe('hidratarCadastroParaEdicaoTaf', () => {
  it('preenche tempos e notas do histórico quando o cadastro está vazio', () => {
    const cadastro: CadastroItemPersist = {
      id: 'c1',
      nip: '12.3456.78',
      nome: 'SILVA',
      dataNascimento: '01/01/1990',
      categoria: 'Praças',
    };
    const seeds = sementesEdicaoFromLinhaResultado({
      tempoCorrida: '12:34:50',
      notaCorrida: 'REPROVADO',
      situacaoCorrida: 'Reprovado',
      tempoNatacao: '01:20:00',
      notaNatacao: '80',
      situacaoPermanencia: 'Aprovado',
      permanenciaTempo: '10:00',
    });
    const h = hidratarCadastroParaEdicaoTaf(cadastro, seeds);
    expect(h.tempoCorrida).toBe('12:34:50');
    expect(h.notaCorrida).toBe('REPROVADO');
    expect(h.tempoNatacao).toBe('01:20:00');
    expect(h.notaNatacao).toBe('80');
    expect(h.resultadoPermanencia).toBe('aprovado');
    expect(h.tempoPermanencia).toBe('10:00');
  });

  it('não sobrescreve tempo já gravado no cadastro', () => {
    const cadastro: CadastroItemPersist = {
      id: 'c1',
      nip: '12.3456.78',
      nome: 'SILVA',
      dataNascimento: '01/01/1990',
      categoria: 'Praças',
      tempoCorrida: '11:00',
      notaCorrida: '90',
    };
    const h = hidratarCadastroParaEdicaoTaf(cadastro, {
      tempoCorrida: '12:34:50',
      notaCorrida: 'REPROVADO',
    });
    expect(h.tempoCorrida).toBe('11:00');
    expect(h.notaCorrida).toBe('90');
  });
});
