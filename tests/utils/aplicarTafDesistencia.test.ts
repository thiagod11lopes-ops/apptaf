import { describe, expect, it } from 'vitest';
import {
  aplicarTafTrialReducer,
  initialTrialTableState,
} from '../../src/screens/aplicarTafTrialReducer';
import { aplicarDesistenciaNoCadastro } from '../../src/screens/aplicarTafNotaHelpers';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import { formatNotaDesistenciaCorrida } from '../../src/utils/notaReprovacaoTexto';

describe('aplicarTafTrialReducer desistência', () => {
  it('confirma desistência gravando tempo, voltas e limpando checklist', () => {
    let state = aplicarTafTrialReducer(initialTrialTableState, {
      type: 'prepararProva',
      nParticipantes: 2,
      tipoProva: 'corrida',
    });
    state = aplicarTafTrialReducer(state, { type: 'resizeChecksGrid', p: 2, v: 3 });
    state = aplicarTafTrialReducer(state, {
      type: 'toggleVoltaCorrida',
      participante: 0,
      volta: 0,
      elapsedMs: 120_000,
    });
    state = aplicarTafTrialReducer(state, {
      type: 'toggleVoltaCorrida',
      participante: 0,
      volta: 1,
      elapsedMs: 240_000,
    });
    expect(state.checksVoltas[0]?.filter(Boolean).length).toBe(2);

    state = aplicarTafTrialReducer(state, {
      type: 'setDesistencia',
      participante: 0,
      value: true,
      elapsedMs: 312_000,
    });

    expect(state.desistenciaParticipantes[0]).toBe(true);
    expect(state.temposMilitaresMs[0]).toBe(312_000);
    expect(state.desistenciaVoltasParticipantes[0]).toBe(2);
    expect(state.checksVoltas[0]?.every((c) => !c)).toBe(true);
    expect(formatNotaDesistenciaCorrida(state.desistenciaVoltasParticipantes[0])).toBe('REP. (2)');
  });

  it('ao desmarcar desistência limpa tempo e voltas capturadas', () => {
    let state = aplicarTafTrialReducer(initialTrialTableState, {
      type: 'prepararProva',
      nParticipantes: 1,
      tipoProva: 'corrida',
    });
    state = aplicarTafTrialReducer(state, { type: 'resizeChecksGrid', p: 1, v: 2 });
    state = aplicarTafTrialReducer(state, {
      type: 'toggleVoltaCorrida',
      participante: 0,
      volta: 0,
      elapsedMs: 60_000,
    });
    state = aplicarTafTrialReducer(state, {
      type: 'setDesistencia',
      participante: 0,
      value: true,
      elapsedMs: 90_000,
    });
    expect(state.desistenciaVoltasParticipantes[0]).toBe(1);

    state = aplicarTafTrialReducer(state, {
      type: 'setDesistencia',
      participante: 0,
      value: false,
    });
    expect(state.desistenciaParticipantes[0]).toBe(false);
    expect(state.temposMilitaresMs[0]).toBeNull();
    expect(state.desistenciaVoltasParticipantes[0]).toBe(0);
  });

  it('bloqueia marcar chegada/volta enquanto desistência está ativa', () => {
    let state = aplicarTafTrialReducer(initialTrialTableState, {
      type: 'prepararProva',
      nParticipantes: 1,
      tipoProva: 'natacao',
    });
    state = aplicarTafTrialReducer(state, {
      type: 'setDesistencia',
      participante: 0,
      value: true,
      elapsedMs: 45_000,
    });
    const blocked = aplicarTafTrialReducer(state, {
      type: 'toggleNatacaoChegada',
      participante: 0,
      elapsedMs: 90_000,
    });
    expect(blocked.temposMilitaresMs[0]).toBe(45_000);
    expect(blocked.chegadaNatacao[0]).toBe(false);
  });
});

describe('aplicarDesistenciaNoCadastro', () => {
  const base: CadastroItemPersist = {
    id: '1',
    nome: 'Teste',
    nip: '12345678',
    dataNascimento: '01/01/1990',
    sexo: 'M',
    categoria: 'Praças',
  };

  it('grava corrida como REP. (voltas) com tempo e data', () => {
    const next = aplicarDesistenciaNoCadastro(base, 'corrida', {
      modoTafNaval: false,
      voltasCompletas: 3,
      tempoMs: 625_000,
    });
    expect(next.notaCorrida).toBe('REP. (3)');
    expect(next.tempoCorrida).toBeTruthy();
    expect((next.dataTafCorrida || '').trim().length).toBeGreaterThan(0);
    expect(next.modalidadeDistanciaAtiva).toBe('corrida');
  });

  it('grava natação como REPROVADO com data', () => {
    const next = aplicarDesistenciaNoCadastro(base, 'natacao', {
      modoTafNaval: true,
      tempoMs: 90_000,
    });
    expect(next.notaNatacao).toBe('REPROVADO');
    expect(next.tempoNatacao).toBeTruthy();
    expect((next.dataTafNatacao || '').trim().length).toBeGreaterThan(0);
  });
});
