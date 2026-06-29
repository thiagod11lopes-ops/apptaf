/** Provas disponíveis na aplicação ao vivo do TAF. */
export type TipoProvaTAF =
  | 'corrida'
  | 'natacao'
  | 'permanencia'
  | 'caminhada'
  | 'flexao_barra'
  | 'flexao_solo'
  | 'abdominal_remador'
  | 'abdominal_prancha';

export type TipoProvaTafPadrao = 'corrida' | 'natacao' | 'permanencia' | 'caminhada';

export type TipoProvaTafNavalExtra =
  | 'flexao_barra'
  | 'flexao_solo'
  | 'abdominal_remador'
  | 'abdominal_prancha';

export function isProvaComVoltas(tipo: TipoProvaTAF | null): boolean {
  return tipo === 'corrida' || tipo === 'caminhada';
}

export function isProvaComRepeticoes(tipo: TipoProvaTAF | null): boolean {
  return tipo === 'flexao_barra' || tipo === 'flexao_solo' || tipo === 'abdominal_remador';
}

export function isProvaComCronometro(tipo: TipoProvaTAF | null): boolean {
  return (
    tipo === 'corrida' ||
    tipo === 'natacao' ||
    tipo === 'caminhada' ||
    tipo === 'abdominal_prancha'
  );
}

export function isProvaNavalExclusiva(tipo: TipoProvaTAF | null): boolean {
  return (
    tipo === 'flexao_barra' ||
    tipo === 'flexao_solo' ||
    tipo === 'abdominal_remador' ||
    tipo === 'abdominal_prancha'
  );
}

export function tituloProvaTaf(tipo: TipoProvaTAF | null, modoTafNaval: boolean): string {
  if (!tipo) return 'Prova';
  if (tipo === 'corrida') return modoTafNaval ? 'Corrida 3200 m' : 'Corrida';
  if (tipo === 'natacao') return modoTafNaval ? 'Natação 100 m' : 'Natação';
  if (tipo === 'permanencia') return 'Permanência';
  if (tipo === 'caminhada') return 'Caminhada';
  if (tipo === 'flexao_barra') return 'Flexão na barra';
  if (tipo === 'flexao_solo') return 'Flexão no solo';
  if (tipo === 'abdominal_remador') return 'Abdominal remador';
  return 'Abdominal prancha';
}

export function labelAtletaProva(tipo: TipoProvaTAF | null): string {
  if (tipo === 'natacao') return 'Nadador';
  if (tipo === 'permanencia') return 'Militar';
  if (tipo === 'caminhada') return 'Caminhante';
  if (tipo === 'flexao_barra' || tipo === 'flexao_solo') return 'Militar';
  if (tipo === 'abdominal_remador' || tipo === 'abdominal_prancha') return 'Militar';
  return 'Corredor';
}
