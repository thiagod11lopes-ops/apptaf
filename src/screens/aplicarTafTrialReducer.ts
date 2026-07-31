/**
 * Estado da tabela de prova (voltas / chegada / tempos / desistência) — atualização atômica
 * para cada clique, evitando dessincronizar tempos entre participantes.
 */

export type TrialTableState = {
  checksVoltas: boolean[][];
  chegadaNatacao: boolean[];
  temposMilitaresMs: (number | null)[];
  /** Corrida/natação: desistência = reprovado. */
  desistenciaParticipantes: boolean[];
  /** Corrida: voltas já marcadas no momento da desistência (para nota REP. (n)). */
  desistenciaVoltasParticipantes: number[];
};

export type TrialTableAction =
  | { type: 'resetAll' }
  | { type: 'hydrate'; state: TrialTableState }
  | { type: 'prepararProva'; nParticipantes: number; tipoProva: 'corrida' | 'natacao' | 'caminhada' }
  | { type: 'resizeChecksGrid'; p: number; v: number }
  | { type: 'resizeChegadaNatacao'; p: number }
  | { type: 'resizeTempos'; p: number }
  | { type: 'resizeDesistencia'; p: number }
  | { type: 'toggleNatacaoChegada'; participante: number; elapsedMs: number | null }
  | {
      type: 'toggleVoltaCorrida';
      participante: number;
      /** Índice clicado (0 = esquerda). Ordem L→R é forçada no reducer. */
      volta: number;
      elapsedMs: number | null;
    }
  | {
      type: 'setDesistencia';
      participante: number;
      value: boolean;
      /** Tempo do cronômetro no momento da confirmação (exibido na prova ativa). */
      elapsedMs?: number | null;
    };

export const initialTrialTableState: TrialTableState = {
  checksVoltas: [],
  chegadaNatacao: [],
  temposMilitaresMs: [],
  desistenciaParticipantes: [],
  desistenciaVoltasParticipantes: [],
};

function ensureBoolRow(arr: boolean[], len: number, fill = false): boolean[] {
  const next = arr.slice(0, len);
  while (next.length < len) next.push(fill);
  return next;
}

function ensureNumRow(arr: number[], len: number, fill = 0): number[] {
  const next = arr.slice(0, len);
  while (next.length < len) next.push(fill);
  return next;
}

function countVoltasMarcadas(row: boolean[] | undefined): number {
  if (!Array.isArray(row)) return 0;
  let n = 0;
  for (const c of row) {
    if (c) n += 1;
  }
  return n;
}

export function aplicarTafTrialReducer(
  state: TrialTableState,
  action: TrialTableAction,
): TrialTableState {
  switch (action.type) {
    case 'resetAll':
      return initialTrialTableState;

    case 'hydrate':
      return {
        checksVoltas: Array.isArray(action.state.checksVoltas)
          ? action.state.checksVoltas.map((row) => (Array.isArray(row) ? [...row] : []))
          : [],
        chegadaNatacao: Array.isArray(action.state.chegadaNatacao)
          ? [...action.state.chegadaNatacao]
          : [],
        temposMilitaresMs: Array.isArray(action.state.temposMilitaresMs)
          ? [...action.state.temposMilitaresMs]
          : [],
        desistenciaParticipantes: Array.isArray(action.state.desistenciaParticipantes)
          ? [...action.state.desistenciaParticipantes]
          : [],
        desistenciaVoltasParticipantes: Array.isArray(action.state.desistenciaVoltasParticipantes)
          ? [...action.state.desistenciaVoltasParticipantes]
          : [],
      };

    case 'prepararProva': {
      const { nParticipantes: n, tipoProva } = action;
      const temposMilitaresMs = Array.from({ length: n }, () => null as number | null);
      const chegadaNatacao =
        tipoProva === 'natacao' ? Array.from({ length: n }, () => false) : [];
      const desistenciaParticipantes = Array.from({ length: n }, () => false);
      const desistenciaVoltasParticipantes = Array.from({ length: n }, () => 0);
      return {
        ...state,
        temposMilitaresMs,
        chegadaNatacao,
        desistenciaParticipantes,
        desistenciaVoltasParticipantes,
      };
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
        desistenciaVoltasParticipantes: ensureNumRow(state.desistenciaVoltasParticipantes, p),
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
      const { participante, volta, elapsedMs } = action;
      if (state.desistenciaParticipantes[participante]) return state;
      const nextChecks = state.checksVoltas.map((row) => [...row]);
      if (!nextChecks[participante]) return state;
      const n = nextChecks[participante].length;
      if (n < 1 || volta < 0 || volta >= n) return state;

      // Prefixo contíguo da esquerda: [✓ ✓ ✓ □ □]
      let prefixLen = 0;
      while (prefixLen < n && nextChecks[participante][prefixLen]) prefixLen += 1;

      const row = Array.from({ length: n }, (_, j) => j < prefixLen);

      if (volta >= prefixLen) {
        // Próximo em ordem — ou clique à frente (pulo): marca o seguinte ao já marcado.
        if (prefixLen < n) row[prefixLen] = true;
      } else if (volta === prefixLen - 1) {
        // Desmarca só o último checklist válido (recuo de um passo).
        row[volta] = false;
      }
      // Clique em checklist já marcado no meio do prefixo: ignora (mantém ordem).

      nextChecks[participante] = row;

      const lastMarcada = n > 0 && row[n - 1] === true;
      const nextTempos = [...state.temposMilitaresMs];
      while (nextTempos.length <= participante) nextTempos.push(null);
      nextTempos[participante] = lastMarcada ? elapsedMs : null;

      return { ...state, checksVoltas: nextChecks, temposMilitaresMs: nextTempos };
    }

    case 'setDesistencia': {
      const { participante, value, elapsedMs } = action;
      const len = Math.max(
        participante + 1,
        state.desistenciaParticipantes.length,
        state.desistenciaVoltasParticipantes.length,
      );
      const nextDes = ensureBoolRow(state.desistenciaParticipantes, len);
      const nextVoltasDes = ensureNumRow(state.desistenciaVoltasParticipantes, len);
      nextDes[participante] = value;

      if (!value) {
        // Desmarcar desistência também limpa o tempo e as voltas capturadas.
        const nextTempos = [...state.temposMilitaresMs];
        while (nextTempos.length <= participante) nextTempos.push(null);
        nextTempos[participante] = null;
        nextVoltasDes[participante] = 0;
        return {
          ...state,
          desistenciaParticipantes: nextDes,
          desistenciaVoltasParticipantes: nextVoltasDes,
          temposMilitaresMs: nextTempos,
        };
      }

      // Captura voltas marcadas ANTES de limpar o checklist.
      nextVoltasDes[participante] = countVoltasMarcadas(state.checksVoltas[participante]);

      // Desistência: grava o tempo do clique e limpa marcas de volta/chegada.
      const nextTempos = [...state.temposMilitaresMs];
      while (nextTempos.length <= participante) nextTempos.push(null);
      nextTempos[participante] =
        elapsedMs != null && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : null;

      const nextChegada = [...state.chegadaNatacao];
      if (nextChegada.length > participante) nextChegada[participante] = false;

      const nextChecks = state.checksVoltas.map((row, i) =>
        i === participante ? row.map(() => false) : [...row],
      );

      return {
        ...state,
        desistenciaParticipantes: nextDes,
        desistenciaVoltasParticipantes: nextVoltasDes,
        temposMilitaresMs: nextTempos,
        chegadaNatacao: nextChegada,
        checksVoltas: nextChecks,
      };
    }

    default:
      return state;
  }
}
