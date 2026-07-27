/**
 * Estado da tabela de prova (voltas / chegada / tempos / desistência) — atualização atômica
 * para cada clique, evitando dessincronizar tempos entre participantes.
 */

export type TrialTableState = {
  checksVoltas: boolean[][];
  chegadaNatacao: boolean[];
  temposMilitaresMs: (number | null)[];
  /** Corrida/natação: desistência = reprovado sem tempo. */
  desistenciaParticipantes: boolean[];
};

export type TrialTableAction =
  | { type: 'resetAll' }
  | { type: 'prepararProva'; nParticipantes: number; tipoProva: 'corrida' | 'natacao' | 'caminhada' }
  | { type: 'resizeChecksGrid'; p: number; v: number }
  | { type: 'resizeChegadaNatacao'; p: number }
  | { type: 'resizeTempos'; p: number }
  | { type: 'resizeDesistencia'; p: number }
  | { type: 'toggleNatacaoChegada'; participante: number; elapsedMs: number | null }
  | {
      type: 'toggleVoltaCorrida';
      participante: number;
      volta: number;
      isLastVolta: boolean;
      elapsedMs: number | null;
    }
  | { type: 'setDesistencia'; participante: number; value: boolean };

export const initialTrialTableState: TrialTableState = {
  checksVoltas: [],
  chegadaNatacao: [],
  temposMilitaresMs: [],
  desistenciaParticipantes: [],
};

function ensureBoolRow(arr: boolean[], len: number, fill = false): boolean[] {
  const next = arr.slice(0, len);
  while (next.length < len) next.push(fill);
  return next;
}

export function aplicarTafTrialReducer(
  state: TrialTableState,
  action: TrialTableAction,
): TrialTableState {
  switch (action.type) {
    case 'resetAll':
      return initialTrialTableState;

    case 'prepararProva': {
      const { nParticipantes: n, tipoProva } = action;
      const temposMilitaresMs = Array.from({ length: n }, () => null as number | null);
      const chegadaNatacao =
        tipoProva === 'natacao' ? Array.from({ length: n }, () => false) : [];
      const desistenciaParticipantes = Array.from({ length: n }, () => false);
      return { ...state, temposMilitaresMs, chegadaNatacao, desistenciaParticipantes };
    }

    case 'resizeChecksGrid': {
      const { p, v } = action;
      const next: boolean[][] = [];
      for (let i = 0; i < p; i += 1) {
        const row: boolean[] = [];
        for (let j = 0; j < v; j += 1) {
          row[j] = state.checksVoltas[i]?.[j] ?? false;
        }
        next[i] = row;
      }
      return { ...state, checksVoltas: next };
    }

    case 'resizeChegadaNatacao': {
      const { p } = action;
      return { ...state, chegadaNatacao: ensureBoolRow(state.chegadaNatacao, p) };
    }

    case 'resizeTempos': {
      const { p } = action;
      const next: (number | null)[] = [];
      for (let i = 0; i < p; i += 1) {
        next[i] = state.temposMilitaresMs[i] ?? null;
      }
      return { ...state, temposMilitaresMs: next };
    }

    case 'resizeDesistencia': {
      const { p } = action;
      return {
        ...state,
        desistenciaParticipantes: ensureBoolRow(state.desistenciaParticipantes, p),
      };
    }

    case 'toggleNatacaoChegada': {
      const { participante, elapsedMs } = action;
      if (state.desistenciaParticipantes[participante]) return state;

      const nextChegada = [...state.chegadaNatacao];
      while (nextChegada.length <= participante) nextChegada.push(false);
      const willBeChecked = !nextChegada[participante];
      nextChegada[participante] = willBeChecked;

      const nextTempos = [...state.temposMilitaresMs];
      while (nextTempos.length <= participante) nextTempos.push(null);
      nextTempos[participante] = willBeChecked ? elapsedMs : null;

      return { ...state, chegadaNatacao: nextChegada, temposMilitaresMs: nextTempos };
    }

    case 'toggleVoltaCorrida': {
      const { participante, volta, isLastVolta, elapsedMs } = action;
      if (state.desistenciaParticipantes[participante]) return state;
      const nextChecks = state.checksVoltas.map((row) => [...row]);
      if (!nextChecks[participante]) return state;
      const row = [...nextChecks[participante]];
      const willBeChecked = !row[volta];
      row[volta] = willBeChecked;
      nextChecks[participante] = row;

      if (!isLastVolta) {
        return { ...state, checksVoltas: nextChecks };
      }

      const nextTempos = [...state.temposMilitaresMs];
      while (nextTempos.length <= participante) nextTempos.push(null);
      nextTempos[participante] = willBeChecked ? elapsedMs : null;

      return { ...state, checksVoltas: nextChecks, temposMilitaresMs: nextTempos };
    }

    case 'setDesistencia': {
      const { participante, value } = action;
      const nextDes = ensureBoolRow(state.desistenciaParticipantes, Math.max(participante + 1, state.desistenciaParticipantes.length));
      nextDes[participante] = value;

      if (!value) {
        return { ...state, desistenciaParticipantes: nextDes };
      }

      // Desistência limpa tempo e marcas de volta/chegada.
      const nextTempos = [...state.temposMilitaresMs];
      while (nextTempos.length <= participante) nextTempos.push(null);
      nextTempos[participante] = null;

      const nextChegada = [...state.chegadaNatacao];
      if (nextChegada.length > participante) nextChegada[participante] = false;

      const nextChecks = state.checksVoltas.map((row, i) =>
        i === participante ? row.map(() => false) : [...row],
      );

      return {
        ...state,
        desistenciaParticipantes: nextDes,
        temposMilitaresMs: nextTempos,
        chegadaNatacao: nextChegada,
        checksVoltas: nextChecks,
      };
    }

    default:
      return state;
  }
}
