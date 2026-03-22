/**
 * Estado da tabela de prova (voltas / chegada / tempos) — atualização atômica
 * para cada clique, evitando dessincronizar tempos entre participantes (ex.: 100/90 fixos).
 */

export type TrialTableState = {
  checksVoltas: boolean[][];
  chegadaNatacao: boolean[];
  temposMilitaresMs: (number | null)[];
};

export type TrialTableAction =
  | { type: 'resetAll' }
  | { type: 'prepararProva'; nParticipantes: number; tipoProva: 'corrida' | 'natacao' }
  | { type: 'resizeChecksGrid'; p: number; v: number }
  | { type: 'resizeChegadaNatacao'; p: number }
  | { type: 'resizeTempos'; p: number }
  | { type: 'toggleNatacaoChegada'; participante: number; elapsedMs: number | null }
  | {
      type: 'toggleVoltaCorrida';
      participante: number;
      volta: number;
      isLastVolta: boolean;
      elapsedMs: number | null;
    };

export const initialTrialTableState: TrialTableState = {
  checksVoltas: [],
  chegadaNatacao: [],
  temposMilitaresMs: [],
};

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
      return { ...state, temposMilitaresMs, chegadaNatacao };
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
      const next: boolean[] = [];
      for (let i = 0; i < p; i += 1) {
        next[i] = state.chegadaNatacao[i] ?? false;
      }
      return { ...state, chegadaNatacao: next };
    }

    case 'resizeTempos': {
      const { p } = action;
      const next: (number | null)[] = [];
      for (let i = 0; i < p; i += 1) {
        next[i] = state.temposMilitaresMs[i] ?? null;
      }
      return { ...state, temposMilitaresMs: next };
    }

    case 'toggleNatacaoChegada': {
      const { participante, elapsedMs } = action;
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

    default:
      return state;
  }
}
