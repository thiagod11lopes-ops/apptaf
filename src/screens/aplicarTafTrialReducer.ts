/**
 * Estado da tabela de prova (voltas / chegada / tempos / desistência) — atualização atômica
 * para cada clique, evitando dessincronizar tempos entre participantes.
 *
 * `marcacoesOrdem`: ordem dos cliques de marcação no teste inteiro.
 * A última chave ativa = única marcação laranja; demais marcadas = verdes.
 */

export type TrialTableState = {
  checksVoltas: boolean[][];
  chegadaNatacao: boolean[];
  temposMilitaresMs: (number | null)[];
  /** Corrida/natação: desistência = reprovado. */
  desistenciaParticipantes: boolean[];
  /** Corrida: voltas já marcadas no momento da desistência (para nota REP. (n VOLTA/VOLTAS)). */
  desistenciaVoltasParticipantes: number[];
  /**
   * Pilha de cliques de marcação (global entre militares).
   * Chaves: `volta:p:v` | `chegada:p` | `perm:p:aprovado`
   */
  marcacoesOrdem: string[];
};

export type TrialTableAction =
  | { type: 'resetAll' }
  | { type: 'hydrate'; state: Partial<TrialTableState> }
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
    }
  | {
      type: 'setTempoParticipante';
      participante: number;
      elapsedMs: number | null;
    }
  | {
      type: 'syncMarcacaoPermanencia';
      participante: number;
      /** null = desmarcado; reprovado não entra no laranja/verde. */
      opcao: 'aprovado' | 'reprovado' | null;
    }
  /** Remove o participante no índice e remapeia marcações dos índices posteriores. */
  | { type: 'removeParticipanteAt'; index: number };

export const initialTrialTableState: TrialTableState = {
  checksVoltas: [],
  chegadaNatacao: [],
  temposMilitaresMs: [],
  desistenciaParticipantes: [],
  desistenciaVoltasParticipantes: [],
  marcacoesOrdem: [],
};

export function chaveMarcacaoVolta(participante: number, volta: number): string {
  return `volta:${participante}:${volta}`;
}

export function chaveMarcacaoChegada(participante: number): string {
  return `chegada:${participante}`;
}

export function chaveMarcacaoPermAprovado(participante: number): string {
  return `perm:${participante}:aprovado`;
}

function pushMarcacao(ordem: string[], key: string): string[] {
  return [...ordem.filter((k) => k !== key), key];
}

function removeMarcacao(ordem: string[], key: string): string[] {
  return ordem.filter((k) => k !== key);
}

function removeMarcacoesDoParticipante(ordem: string[], participante: number): string[] {
  const voltaPrefix = `volta:${participante}:`;
  const chegada = chaveMarcacaoChegada(participante);
  const perm = chaveMarcacaoPermAprovado(participante);
  return ordem.filter(
    (k) => !k.startsWith(voltaPrefix) && k !== chegada && k !== perm,
  );
}

function marcacaoAindaAtiva(state: TrialTableState, key: string): boolean {
  if (key.startsWith('volta:')) {
    const parts = key.split(':');
    const p = Number(parts[1]);
    const v = Number(parts[2]);
    if (!Number.isFinite(p) || !Number.isFinite(v)) return false;
    return state.checksVoltas[p]?.[v] === true;
  }
  if (key.startsWith('chegada:')) {
    const p = Number(key.slice('chegada:'.length));
    if (!Number.isFinite(p)) return false;
    return state.chegadaNatacao[p] === true;
  }
  if (key.startsWith('perm:') && key.endsWith(':aprovado')) {
    // Validado na UI via resultadosPermanencia; ordem só guarda o clique.
    return true;
  }
  return false;
}

/** Remove chaves órfãs e devolve a última marcação ainda ativa (laranja). */
export function ultimaMarcacaoLaranjaKey(
  state: Pick<TrialTableState, 'marcacoesOrdem' | 'checksVoltas' | 'chegadaNatacao'>,
  opts?: { permanenteAprovadoAtivo?: (participante: number) => boolean },
): string | null {
  const ordem = state.marcacoesOrdem ?? [];
  for (let i = ordem.length - 1; i >= 0; i -= 1) {
    const key = ordem[i]!;
    if (key.startsWith('perm:') && key.endsWith(':aprovado')) {
      const m = /^perm:(\d+):aprovado$/.exec(key);
      if (!m) continue;
      const p = Number(m[1]);
      if (!Number.isFinite(p)) continue;
      if (opts?.permanenteAprovadoAtivo?.(p)) return key;
      continue;
    }
    if (marcacaoAindaAtiva(state as TrialTableState, key)) return key;
  }
  return null;
}

function pruneMarcacoesOrdem(state: TrialTableState): string[] {
  const ordem = state.marcacoesOrdem ?? [];
  return ordem.filter((key) => {
    if (key.startsWith('perm:') && key.endsWith(':aprovado')) {
      // Mantém até syncMarcacaoPermanencia remover; prune não tem resultadosPermanencia.
      return true;
    }
    return marcacaoAindaAtiva(state, key);
  });
}

/** Reconstrói ordem espacial (legado / hydrate sem pilha). */
function rebuildMarcacoesOrdemEspacial(state: TrialTableState): string[] {
  const keys: string[] = [];
  for (let p = 0; p < state.checksVoltas.length; p += 1) {
    const row = state.checksVoltas[p] ?? [];
    for (let v = 0; v < row.length; v += 1) {
      if (row[v]) keys.push(chaveMarcacaoVolta(p, v));
    }
  }
  for (let p = 0; p < state.chegadaNatacao.length; p += 1) {
    if (state.chegadaNatacao[p]) keys.push(chaveMarcacaoChegada(p));
  }
  return keys;
}

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

function normalizeHydrateState(raw: Partial<TrialTableState>): TrialTableState {
  const base: TrialTableState = {
    checksVoltas: Array.isArray(raw.checksVoltas)
      ? raw.checksVoltas.map((row) => (Array.isArray(row) ? [...row] : []))
      : [],
    chegadaNatacao: Array.isArray(raw.chegadaNatacao) ? [...raw.chegadaNatacao] : [],
    temposMilitaresMs: Array.isArray(raw.temposMilitaresMs) ? [...raw.temposMilitaresMs] : [],
    desistenciaParticipantes: Array.isArray(raw.desistenciaParticipantes)
      ? [...raw.desistenciaParticipantes]
      : [],
    desistenciaVoltasParticipantes: Array.isArray(raw.desistenciaVoltasParticipantes)
      ? [...raw.desistenciaVoltasParticipantes]
      : [],
    marcacoesOrdem: Array.isArray(raw.marcacoesOrdem) ? [...raw.marcacoesOrdem] : [],
  };
  if (base.marcacoesOrdem.length === 0) {
    base.marcacoesOrdem = rebuildMarcacoesOrdemEspacial(base);
  } else {
    base.marcacoesOrdem = pruneMarcacoesOrdem(base);
  }
  return base;
}

function remapMarcacaoKeyAposRemocao(key: string, removedIndex: number): string | null {
  if (key.startsWith('volta:')) {
    const parts = key.split(':');
    const p = Number(parts[1]);
    const v = Number(parts[2]);
    if (!Number.isFinite(p) || !Number.isFinite(v)) return null;
    if (p === removedIndex) return null;
    if (p > removedIndex) return chaveMarcacaoVolta(p - 1, v);
    return key;
  }
  if (key.startsWith('chegada:')) {
    const p = Number(key.slice('chegada:'.length));
    if (!Number.isFinite(p)) return null;
    if (p === removedIndex) return null;
    if (p > removedIndex) return chaveMarcacaoChegada(p - 1);
    return key;
  }
  if (key.startsWith('perm:') && key.endsWith(':aprovado')) {
    const m = /^perm:(\d+):aprovado$/.exec(key);
    if (!m) return null;
    const p = Number(m[1]);
    if (!Number.isFinite(p)) return null;
    if (p === removedIndex) return null;
    if (p > removedIndex) return chaveMarcacaoPermAprovado(p - 1);
    return key;
  }
  return key;
}

function remapMarcacoesOrdemAposRemocao(ordem: string[], removedIndex: number): string[] {
  const next: string[] = [];
  for (const key of ordem) {
    const remapped = remapMarcacaoKeyAposRemocao(key, removedIndex);
    if (remapped) next.push(remapped);
  }
  return next;
}

export function aplicarTafTrialReducer(
  state: TrialTableState,
  action: TrialTableAction,
): TrialTableState {
  switch (action.type) {
    case 'resetAll':
      return initialTrialTableState;

    case 'hydrate':
      return normalizeHydrateState(action.state);

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
        marcacoesOrdem: [],
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
      const nextState: TrialTableState = { ...state, checksVoltas: next };
      nextState.marcacoesOrdem = pruneMarcacoesOrdem(nextState).filter((key) => {
        if (!key.startsWith('volta:')) return true;
        const parts = key.split(':');
        const pi = Number(parts[1]);
        const vi = Number(parts[2]);
        return pi < p && vi < v;
      });
      return nextState;
    }

    case 'resizeChegadaNatacao': {
      const { p } = action;
      const nextState: TrialTableState = {
        ...state,
        chegadaNatacao: ensureBoolRow(state.chegadaNatacao, p),
      };
      nextState.marcacoesOrdem = pruneMarcacoesOrdem(nextState).filter((key) => {
        if (!key.startsWith('chegada:')) return true;
        const pi = Number(key.slice('chegada:'.length));
        return pi < p;
      });
      return nextState;
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

      const key = chaveMarcacaoChegada(participante);
      const marcacoesOrdem = willBeChecked
        ? pushMarcacao(state.marcacoesOrdem ?? [], key)
        : removeMarcacao(state.marcacoesOrdem ?? [], key);

      return {
        ...state,
        chegadaNatacao: nextChegada,
        temposMilitaresMs: nextTempos,
        marcacoesOrdem,
      };
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
      const prefixAntes = prefixLen;

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

      const prefixDepois = countVoltasMarcadas(row);
      let marcacoesOrdem = [...(state.marcacoesOrdem ?? [])];
      if (prefixDepois > prefixAntes) {
        marcacoesOrdem = pushMarcacao(
          marcacoesOrdem,
          chaveMarcacaoVolta(participante, prefixDepois - 1),
        );
      } else if (prefixDepois < prefixAntes) {
        marcacoesOrdem = removeMarcacao(
          marcacoesOrdem,
          chaveMarcacaoVolta(participante, prefixAntes - 1),
        );
      }

      const lastMarcada = n > 0 && row[n - 1] === true;
      const nextTempos = [...state.temposMilitaresMs];
      while (nextTempos.length <= participante) nextTempos.push(null);
      nextTempos[participante] = lastMarcada ? elapsedMs : null;

      return {
        ...state,
        checksVoltas: nextChecks,
        temposMilitaresMs: nextTempos,
        marcacoesOrdem,
      };
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
        marcacoesOrdem: removeMarcacoesDoParticipante(state.marcacoesOrdem ?? [], participante),
      };
    }

    case 'setTempoParticipante': {
      const { participante, elapsedMs } = action;
      const nextTempos = [...state.temposMilitaresMs];
      while (nextTempos.length <= participante) nextTempos.push(null);
      nextTempos[participante] =
        elapsedMs != null && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : null;
      return { ...state, temposMilitaresMs: nextTempos };
    }

    case 'syncMarcacaoPermanencia': {
      const { participante, opcao } = action;
      let marcacoesOrdem = [...(state.marcacoesOrdem ?? [])];
      const key = chaveMarcacaoPermAprovado(participante);
      if (opcao === 'aprovado') {
        marcacoesOrdem = pushMarcacao(marcacoesOrdem, key);
      } else {
        marcacoesOrdem = removeMarcacao(marcacoesOrdem, key);
      }
      return { ...state, marcacoesOrdem };
    }

    case 'removeParticipanteAt': {
      const { index } = action;
      if (index < 0) return state;
      const spliceAt = <T,>(arr: T[]): T[] => arr.filter((_, i) => i !== index);
      return {
        checksVoltas: spliceAt(state.checksVoltas),
        chegadaNatacao: spliceAt(state.chegadaNatacao),
        temposMilitaresMs: spliceAt(state.temposMilitaresMs),
        desistenciaParticipantes: spliceAt(state.desistenciaParticipantes),
        desistenciaVoltasParticipantes: spliceAt(state.desistenciaVoltasParticipantes),
        marcacoesOrdem: remapMarcacoesOrdemAposRemocao(state.marcacoesOrdem ?? [], index),
      };
    }

    default:
      return state;
  }
}
