import { describe, expect, it } from 'vitest';
import {
  celulaNotaComTempoHtml,
  celulaSituacaoComTempoHtml,
  tempoParaCelulaPdf,
} from '../../src/utils/celulaNotaComTempoPdf';
import { valoresCorridaCaminhadaParaPdf } from '../../src/utils/corridaCaminhadaExcludente';

describe('celulaNotaComTempoPdf', () => {
  it('omite tempo vazio ou traço', () => {
    expect(tempoParaCelulaPdf('')).toBe('');
    expect(tempoParaCelulaPdf('—')).toBe('');
    expect(tempoParaCelulaPdf('12:34')).toBe('12:34');
  });

  it('coloca o tempo abaixo da nota no HTML', () => {
    expect(celulaNotaComTempoHtml('80', '12:34:50')).toContain('80');
    expect(celulaNotaComTempoHtml('80', '12:34:50')).toContain('class="tempo"');
    expect(celulaNotaComTempoHtml('80', '12:34:50')).toContain('12:34:50');
    expect(celulaNotaComTempoHtml('REPROVADO', '')).toBe(
      '<td class="nota">REPROVADO</td>',
    );
  });

  it('coloca o tempo abaixo da situação da permanência', () => {
    const html = celulaSituacaoComTempoHtml('Aprovado', '10:00');
    expect(html).toContain('Aprovado');
    expect(html).toContain('10:00');
  });
});

describe('valoresCorridaCaminhadaParaPdf tempos', () => {
  it('inclui tempo da corrida vigente', () => {
    const v = valoresCorridaCaminhadaParaPdf({
      notaCorrida: '90',
      situacaoCorrida: 'Aprovado',
      notaCaminhada: '—',
      situacaoCaminhada: '—',
      tempoCorrida: '11:20:00',
      tempoCaminhada: '45:00',
    });
    expect(v.tempoCorrida).toBe('11:20:00');
    expect(v.tempoCaminhada).toBe('');
  });
});
