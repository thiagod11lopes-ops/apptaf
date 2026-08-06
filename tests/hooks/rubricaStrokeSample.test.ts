import { describe, expect, it } from 'vitest';
import {
  RUBRICA_STROKE_MIN_DIST_SQ,
  shouldAppendRubricaPoint,
} from '../../src/hooks/useRubricaStrokeDraw';

describe('shouldAppendRubricaPoint', () => {
  it('aceita o primeiro ponto', () => {
    expect(shouldAppendRubricaPoint(null, 10, 10)).toBe(true);
  });

  it('ignora micro-movimentos abaixo do limiar', () => {
    expect(shouldAppendRubricaPoint({ x: 10, y: 10 }, 10.5, 10.5)).toBe(false);
  });

  it('aceita movimento a partir do limiar', () => {
    const d = Math.sqrt(RUBRICA_STROKE_MIN_DIST_SQ);
    expect(shouldAppendRubricaPoint({ x: 0, y: 0 }, d, 0)).toBe(true);
  });
});
