import { readAppMeta, readAppMetaCache, removeAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import type { CadastroItemPersist } from './cadastrosIndexedDb';
import type { ResultadoCorridaItem } from '../navigation/types';
import type { TipoProvaTAF } from '../taf/tafProvaTypes';
import type { TrialTableState } from '../screens/aplicarTafTrialReducer';
import type { TafCronometroEstado } from '../hooks/useTafReactStopwatch';
import type { ResultadoPermanenciaOpcao } from '../components/PermanenciaTafPanel';

export const PROVA_ATIVA_SESSION_META_KEY = 'provaAtiva:session';

/** Sessão local de prova ainda não lançada pela rúbrica do aplicador. */
export type ProvaAtivaFinalizacaoFase =
  | 'rubrica_candidatos'
  | 'aplicador'
  | 'tempo_registrado';

export type ProvaAtivaNipFeedback =
  | { tipo: 'ok'; texto: string; nomeMilitar: string; dataNascimento: string; sexo?: 'M' | 'F' }
  | {
      tipo: 'completar_dados';
      nomeMilitar: string;
      cadastro: CadastroItemPersist;
      dataNascimento: string;
      sexo: 'M' | 'F';
      erro?: string;
    }
  | { tipo: 'erro'; texto: string }
  | null;

export type ProvaAtivaSessionV1 = {
  v: 1;
  savedAt: number;
  tipoProva: TipoProvaTAF;
  modoTafNaval: boolean;
  corridaEtapa: 'tabela_corrida' | 'tabela_permanencia' | 'tabela_repeticoes' | 'nips';
  nipsParticipantes: string[];
  nipFeedbackLinhas: ProvaAtivaNipFeedback[];
  trialTable: TrialTableState;
  numeroVoltas: string;
  voltasConfirmadas: boolean;
  repeticoesParticipantes: string[];
  resultadoPermanenciaLinhas: ResultadoPermanenciaOpcao[];
  cronometro: {
    estado: TafCronometroEstado;
    elapsedMs: number;
    wallClockAtSave: number;
  };
  nipsRepeticaoAutorizada: number[];
  finalizacao?: {
    fase: ProvaAtivaFinalizacaoFase;
    resultados: ResultadoCorridaItem[];
    pendingCadastros: CadastroItemPersist[];
    indiceRubrica?: number;
    listaResultadosRubrica?: ResultadoCorridaItem[];
  };
};

const TTL_MS = 72 * 60 * 60 * 1000;

function isTipoProva(v: unknown): v is TipoProvaTAF {
  return (
    v === 'corrida' ||
    v === 'natacao' ||
    v === 'permanencia' ||
    v === 'caminhada' ||
    v === 'flexao_barra' ||
    v === 'flexao_solo' ||
    v === 'abdominal_remador' ||
    v === 'abdominal_prancha'
  );
}

function isEtapa(v: unknown): v is ProvaAtivaSessionV1['corridaEtapa'] {
  return (
    v === 'tabela_corrida' ||
    v === 'tabela_permanencia' ||
    v === 'tabela_repeticoes' ||
    v === 'nips'
  );
}

function parseSession(raw: string | null): ProvaAtivaSessionV1 | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<ProvaAtivaSessionV1>;
    if (data.v !== 1) return null;
    if (typeof data.savedAt !== 'number' || !Number.isFinite(data.savedAt)) return null;
    if (Date.now() - data.savedAt > TTL_MS) return null;
    if (!isTipoProva(data.tipoProva) || !isEtapa(data.corridaEtapa)) return null;
    if (!Array.isArray(data.nipsParticipantes) || data.nipsParticipantes.length < 1) return null;
    if (!data.trialTable || typeof data.trialTable !== 'object') return null;
    if (!data.cronometro || typeof data.cronometro !== 'object') return null;
    if (typeof data.cronometro.elapsedMs !== 'number') return null;
    return data as ProvaAtivaSessionV1;
  } catch {
    return null;
  }
}

/** Leitura síncrona do cache (após hidratação do app). */
export function peekProvaAtivaSession(): ProvaAtivaSessionV1 | null {
  return parseSession(readAppMetaCache(PROVA_ATIVA_SESSION_META_KEY));
}

export async function loadProvaAtivaSession(): Promise<ProvaAtivaSessionV1 | null> {
  const raw = await readAppMeta(PROVA_ATIVA_SESSION_META_KEY);
  const session = parseSession(raw);
  if (!session && raw?.trim()) {
    await clearProvaAtivaSession();
  }
  return session;
}

export async function saveProvaAtivaSession(session: ProvaAtivaSessionV1): Promise<void> {
  await writeAppMeta(PROVA_ATIVA_SESSION_META_KEY, JSON.stringify(session));
}

export async function clearProvaAtivaSession(): Promise<void> {
  await removeAppMeta(PROVA_ATIVA_SESSION_META_KEY);
}

/** Elapsed ajustado se o cronômetro estava rodando ao fechar. */
export function resolveCronometroElapsedMs(session: ProvaAtivaSessionV1): number {
  const base = Math.max(0, Math.floor(session.cronometro.elapsedMs));
  if (session.cronometro.estado !== 'rodando') return base;
  const wall = session.cronometro.wallClockAtSave;
  if (typeof wall !== 'number' || !Number.isFinite(wall)) return base;
  return base + Math.max(0, Date.now() - wall);
}
