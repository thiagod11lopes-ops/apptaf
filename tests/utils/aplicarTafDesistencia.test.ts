import { describe, expect, it } from 'vitest';
import {
  aplicarTafTrialReducer,
  initialTrialTableState,
} from '../../src/screens/aplicarTafTrialReducer';
import { aplicarDesistenciaNoCadastro } from '../../src/screens/aplicarTafNotaHelpers';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';

describe('aplicarTafTrialReducer desistência', () => {
  it('confirma desistência limpando tempo, voltas e chegada', () => {
    let state = aplicarTafTrialReducer(initialTrialTableState, {
      type: 'prepararProva',
      nParticipantes: 2,
      tipoProva: 'corrida',
    });
    state = aplicarTafTrialReducer(state, { type: 'resizeChecksGrid', p: 2, v: 2 });
    state = aplicarTafTrialReducer(state, {
      type: 'toggleVoltaCorrida',
      participante: 0,
      volta: 1,
      isLastVolta: true,
      elapsedMs: 540_000,
    });
    expect(state.temposMilitaresMs[0]).toBe(540_000);

    state = aplicarTafTrialReducer(state, {
      type: 'setDesistencia',
      participante: 0,
      value: true,
    });

    expect(state.desistenciaParticipantes[0]).toBe(true);
    expect(state.temposMilitaresMs[0]).toBeNull();
    expect(state.checksVoltas[0]?.every((c) => !c)).toBe(true);
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
    });
    const blocked = aplicarTafTrialReducer(state, {
      type: 'toggleNatacaoChegada',
      participante: 0,
      elapsedMs: 90_000,
    });
    expect(blocked.temposMilitaresMs[0]).toBeNull();
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

  it('grava corrida como REPROVADO sem tempo e com data', () => {
    const next = aplicarDesistenciaNoCadastro(base, 'corrida', { modoTafNaval: false });
    expect(next.notaCorrida).toBe('REPROVADO');
    expect(next.tempoCorrida).toBeUndefined();
    expect((next.dataTafCorrida || '').trim().length).toBeGreaterThan(0);
    expect(next.modalidadeDistanciaAtiva).toBe('corrida');
  });

  it('grava natação como REPROVADO sem tempo e com data', () => {
    const next = aplicarDesistenciaNoCadastro(base, 'natacao', { modoTafNaval: true });
    expect(next.notaNatacao).toBe('REPROVADO');
    expect(next.tempoNatacao).toBeUndefined();
    expect((next.dataTafNatacao || '').trim().length).toBeGreaterThan(0);
  });
});
