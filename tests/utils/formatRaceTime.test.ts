import { describe, expect, it } from 'vitest';
import {
  formatCronometroElapsedMs,
  formatElapsedMs,
  parseFormatoElapsedParaMs,
  msParaSegundosProvaInteiros,
} from '../../src/utils/formatRaceTime';

describe('formatRaceTime MM:SS:CS', () => {
  it('formata minutos, segundos e centésimos', () => {
    expect(formatElapsedMs(0)).toBe('00:00:00');
    expect(formatElapsedMs(1_030)).toBe('00:01:03');
    expect(formatElapsedMs(303_450)).toBe('05:03:45');
    expect(formatElapsedMs(10 * 60 * 1000)).toBe('10:00:00');
  });

  it('formata cronômetro só com minutos e segundos', () => {
    expect(formatCronometroElapsedMs(0)).toBe('00:00');
    expect(formatCronometroElapsedMs(1_030)).toBe('00:01');
    expect(formatCronometroElapsedMs(303_450)).toBe('05:03');
    expect(formatCronometroElapsedMs(10 * 60 * 1000)).toBe('10:00');
  });

  it('interpreta MM:SS:CS e legado MM:SS', () => {
    expect(parseFormatoElapsedParaMs('05:03:45')).toBe(303_450);
    expect(parseFormatoElapsedParaMs('05:03')).toBe(303_000);
    expect(parseFormatoElapsedParaMs('00:01:03')).toBe(1_030);
  });

  it('trunca centésimos para nota em segundos', () => {
    expect(msParaSegundosProvaInteiros(303_450)).toBe(303);
    expect(msParaSegundosProvaInteiros(999)).toBe(0);
  });
});
