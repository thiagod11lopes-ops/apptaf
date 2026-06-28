import { describe, expect, it } from 'vitest';
import { notaCaminhada4800, textoNotaCaminhada } from './caminhada4800Nota';

function minMs(min: number, sec = 0): number {
  return (min * 60 + sec) * 1000;
}

describe('notaCaminhada4800', () => {
  it('masculino 18–25: tempo dentro do limite da nota 100', () => {
    expect(notaCaminhada4800(minMs(37, 59), 22, 'M')).toEqual({ kind: 'nota', valor: 100 });
  });

  it('masculino 18–25: tempo no limite exato de 38 min → nota 100', () => {
    expect(notaCaminhada4800(minMs(38), 22, 'M')).toEqual({ kind: 'nota', valor: 100 });
  });

  it('masculino 18–25: 38:01 → nota 90', () => {
    expect(notaCaminhada4800(minMs(38, 1), 22, 'M')).toEqual({ kind: 'nota', valor: 90 });
  });

  it('masculino 18–25: acima de 48 min → reprovado', () => {
    expect(notaCaminhada4800(minMs(48, 1), 22, 'M')).toEqual({ kind: 'reprovado' });
  });

  it('feminino 18–25: 39 min → nota 100', () => {
    expect(notaCaminhada4800(minMs(39), 22, 'F')).toEqual({ kind: 'nota', valor: 100 });
  });

  it('idade abaixo de 18 → fora da tabela', () => {
    expect(textoNotaCaminhada(minMs(35), 17, 'M')).toBe('—');
  });
});
