import { describe, expect, it } from 'vitest';
import {
  aplicarTafTrialReducer,
  chaveMarcacaoVolta,
  initialTrialTableState,
  ultimaMarcacaoLaranjaKey,
  type TrialTableState,
} from '../../src/screens/aplicarTafTrialReducer';

function stateComDoisETresVoltas(): TrialTableState {
  let s = aplicarTafTrialReducer(initialTrialTableState, {
    type: 'prepararProva',
    nParticipantes: 2,
    tipoProva: 'corrida',
  });
  s = aplicarTafTrialReducer(s, { type: 'resizeChecksGrid', p: 2, v: 3 });
  return s;
}

describe('aplicarTafTrialReducer — marcação laranja global', () => {
  it('só uma volta laranja entre militares; nova marcação promove a anterior a “não laranja”', () => {
    let s = stateComDoisETresVoltas();

    s = aplicarTafTrialReducer(s, {
      type: 'toggleVoltaCorrida',
      participante: 0,
      volta: 0,
      elapsedMs: null,
    });
    expect(ultimaMarcacaoLaranjaKey(s)).toBe(chaveMarcacaoVolta(0, 0));

    s = aplicarTafTrialReducer(s, {
      type: 'toggleVoltaCorrida',
      participante: 1,
      volta: 0,
      elapsedMs: null,
    });
    expect(ultimaMarcacaoLaranjaKey(s)).toBe(chaveMarcacaoVolta(1, 0));
    expect(s.checksVoltas[0]?.[0]).toBe(true);
    expect(s.checksVoltas[1]?.[0]).toBe(true);
  });

  it('ao desmarcar a laranja, a marcação mais recente restante vira laranja', () => {
    let s = stateComDoisETresVoltas();

    s = aplicarTafTrialReducer(s, {
      type: 'toggleVoltaCorrida',
      participante: 0,
      volta: 0,
      elapsedMs: null,
    });
    s = aplicarTafTrialReducer(s, {
      type: 'toggleVoltaCorrida',
      participante: 1,
      volta: 0,
      elapsedMs: null,
    });
    expect(ultimaMarcacaoLaranjaKey(s)).toBe(chaveMarcacaoVolta(1, 0));

    // Desmarca a volta do n.º 2 (laranja)
    s = aplicarTafTrialReducer(s, {
      type: 'toggleVoltaCorrida',
      participante: 1,
      volta: 0,
      elapsedMs: null,
    });
    expect(s.checksVoltas[1]?.[0]).toBe(false);
    expect(ultimaMarcacaoLaranjaKey(s)).toBe(chaveMarcacaoVolta(0, 0));
  });

  it('natação: chegada também entra na pilha global', () => {
    let s = aplicarTafTrialReducer(initialTrialTableState, {
      type: 'prepararProva',
      nParticipantes: 2,
      tipoProva: 'natacao',
    });
    s = aplicarTafTrialReducer(s, {
      type: 'toggleNatacaoChegada',
      participante: 0,
      elapsedMs: 1000,
    });
    expect(ultimaMarcacaoLaranjaKey(s)).toBe('chegada:0');

    s = aplicarTafTrialReducer(s, {
      type: 'toggleNatacaoChegada',
      participante: 1,
      elapsedMs: 2000,
    });
    expect(ultimaMarcacaoLaranjaKey(s)).toBe('chegada:1');
  });
});
